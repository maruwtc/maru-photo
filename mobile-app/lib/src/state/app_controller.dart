import 'dart:async';
import 'package:flutter/foundation.dart';

import '../models/app_models.dart';
import '../services/auth_service.dart';
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

  Future<void> bootstrap() async {
    isBootstrapping = false;
    notifyListeners();
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

  Future<void> pickFilesForUpload() async {
    errorMessage = null;
    final selected = await _uploadService.pickFiles();
    if (selected.isEmpty) {
      return;
    }

    queue = [...selected, ...queue];
    notifyListeners();
  }

  Future<void> uploadPendingQueue() async {
    if (session == null) {
      errorMessage = 'Sign in first before uploading files.';
      notifyListeners();
      return;
    }

    for (final item in queue) {
      if (item.status == 'done') {
        continue;
      }

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
        return;
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
