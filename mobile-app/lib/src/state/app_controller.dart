import 'dart:async';
import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_models.dart';
import '../services/auth_service.dart';
import '../services/auto_backup_service.dart';
import '../services/upload_service.dart';

class AppController extends ChangeNotifier {
  AppController({
    required AuthService authService,
    required UploadService uploadService,
  })  : _authService = authService,
        _uploadService = uploadService;

  final AuthService _authService;
  final UploadService _uploadService;

  bool isBootstrapping = true;
  bool isSigningIn = false;
  bool isRefreshing = false;
  String? errorMessage;
  String? signInStatusMessage;

  AppSession? session;
  DeviceInfo? deviceInfo;
  MicrosoftStatus? microsoftStatus;
  List<AssetItem> assets = const [];
  List<BackupQueueItem> queue = const [];
  String? firebaseEmail;
  String? firebasePhotoUrl;

  // Auto-backup
  bool autoBackupEnabled = false;
  DateTime? lastAutoBackupTime;

  // Appearance
  ThemeMode themeMode = ThemeMode.system;

  Future<void> bootstrap() async {
    autoBackupEnabled = await AutoBackupService.isEnabled();
    lastAutoBackupTime = await AutoBackupService.getLastBackupTime();
    themeMode = await _loadThemeMode();
    isBootstrapping = false;
    notifyListeners();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString('theme_mode', mode.name);
  }

  static Future<ThemeMode> _loadThemeMode() async {
    final p = await SharedPreferences.getInstance();
    switch (p.getString('theme_mode')) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> signInFlow() async {
    isSigningIn = true;
    errorMessage = null;
    signInStatusMessage = 'Opening Google sign-in';
    notifyListeners();

    try {
      final credential = await _runStep(
        'Opening Google sign-in',
        _authService.signInWithGoogle,
      );
      firebaseEmail = credential.user?.email;
      firebasePhotoUrl = credential.user?.photoURL;
      session = await _runStep(
        'Verifying app session with backend',
        _authService.exchangeFirebaseToken,
      );
      deviceInfo = await _runStep(
        'Registering this device',
        () => _authService.registerDevice(session!.accessToken),
      );
      microsoftStatus = await _runStep(
        'Loading Microsoft storage status',
        () => _authService.fetchMicrosoftStatus(session!.accessToken),
      );
      assets = await _runStep(
        'Loading your library',
        () => _uploadService.fetchAssets(session!.accessToken),
      );
      // Persist token for background auto-backup task
      await AutoBackupService.saveToken(session!.accessToken);
      signInStatusMessage = 'Ready';
    } catch (error) {
      errorMessage = _normalizeErrorMessage(error);
    } finally {
      isSigningIn = false;
      notifyListeners();
    }
  }

  Future<void> refreshDashboard() async {
    if (session == null) {
      return;
    }

    isRefreshing = true;
    errorMessage = null;
    signInStatusMessage = 'Refreshing account state';
    notifyListeners();

    try {
      microsoftStatus = await _authService.fetchMicrosoftStatus(session!.accessToken);
      assets = await _uploadService.fetchAssets(session!.accessToken);
    } catch (error) {
      errorMessage = _normalizeErrorMessage(error);
    } finally {
      isRefreshing = false;
      signInStatusMessage = null;
      notifyListeners();
    }
  }

  Future<void> toggleAutoBackup() async {
    if (autoBackupEnabled) {
      await AutoBackupService.disable();
      autoBackupEnabled = false;
      notifyListeners();
      return;
    }

    // Request photo library permission first
    final permission = await AutoBackupService.requestPermission();
    if (!permission.isAuth) {
      errorMessage = 'Photo library access is required for auto-backup. '
          'Grant it in Settings → App Permissions.';
      notifyListeners();
      return;
    }

    if (session == null) {
      errorMessage = 'Sign in before enabling auto-backup.';
      notifyListeners();
      return;
    }

    await AutoBackupService.enable(session!.accessToken);
    autoBackupEnabled = true;
    lastAutoBackupTime = await AutoBackupService.getLastBackupTime();
    notifyListeners();
  }

  Future<void> pickFilesForUpload() async {
    errorMessage = null;
    final selected = await _uploadService.pickFiles();
    if (selected.isEmpty) {
      return;
    }

    queue = [...selected, ...queue];
    notifyListeners();

    // Auto-start upload immediately if already signed in.
    if (session != null) {
      unawaited(uploadPendingQueue());
    }
  }

  Future<void> uploadPendingQueue() async {
    if (session == null) {
      errorMessage = 'Sign in first before uploading files.';
      notifyListeners();
      return;
    }

    // Snapshot the items to process so new additions mid-upload don't interfere.
    final pending = queue.where((q) => q.status != 'done' && q.status != 'failed').toList();

    for (final item in pending) {
      try {
        await _uploadService.uploadQueueItem(
          accessToken: session!.accessToken,
          item: item,
          onUpdate: (updated) => _replaceQueueItem(updated),
        );
      } catch (error) {
        _replaceQueueItem(
          item.copyWith(
            status: 'failed',
            message: _normalizeErrorMessage(error),
          ),
        );
        errorMessage = _normalizeErrorMessage(error);
        notifyListeners();
        // Continue with the next file rather than aborting the whole queue.
      }
    }

    assets = await _uploadService.fetchAssets(session!.accessToken);
    notifyListeners();
  }

  Future<T> _runStep<T>(
    String message,
    Future<T> Function() action,
  ) async {
    signInStatusMessage = message;
    notifyListeners();
    return action().timeout(
      const Duration(seconds: 45),
      onTimeout: () => throw AuthFlowException('$message timed out. Check configuration or network and try again.'),
    );
  }

  String _normalizeErrorMessage(Object error) {
    final raw = error.toString();
    if (raw.startsWith('ApiException(')) {
      final separator = raw.indexOf(': ');
      return separator >= 0 ? raw.substring(separator + 2) : raw;
    }
    if (raw.startsWith('Exception: ')) {
      return raw.substring('Exception: '.length);
    }
    return raw;
  }

  void _replaceQueueItem(BackupQueueItem updated) {
    queue = [
      for (final item in queue)
        if (item.id == updated.id) updated else item,
    ];
    notifyListeners();
  }
}
