import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:workmanager/workmanager.dart';

import 'src/config/app_config.dart';
import 'src/models/app_models.dart';
import 'src/services/api_client.dart';
import 'src/services/auto_backup_service.dart';
import 'src/services/upload_service.dart';

/// WorkManager callback dispatcher — runs in its own Dart isolate.
/// Must be a top-level function annotated with @pragma('vm:entry-point').
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    WidgetsFlutterBinding.ensureInitialized();

    if (taskName != AutoBackupService.taskName) return true;

    // ── 1. Check that we have a saved session token ─────────────────────────
    final token = await AutoBackupService.getSavedToken();
    if (token == null || token.isEmpty) return true;

    // ── 2. Check photo permission ───────────────────────────────────────────
    final permission = await AutoBackupService.requestPermission();
    if (!permission.isAuth) return true;

    // ── 3. Get new device photos since last backup ──────────────────────────
    final newPhotos = await AutoBackupService.getNewDevicePhotos();
    if (newPhotos.isEmpty) {
      await AutoBackupService.markBackupDone();
      return true;
    }

    // ── 4. Upload each photo ────────────────────────────────────────────────
    final apiClient = ApiClient(baseUrl: AppConfig.apiBaseUrl);
    final uploadService = UploadService(apiClient: apiClient);

    for (final asset in newPhotos) {
      try {
        final file = await asset.file;
        if (file == null) continue;

        final stat = await File(file.path).stat();

        final item = BackupQueueItem(
          id: asset.id,
          fileName: asset.title ?? 'photo_${asset.id}',
          fileSize: stat.size,
          localPath: file.path,
          progress: 0,
          status: 'queued',
          message: 'Auto backup',
        );

        await uploadService.uploadQueueItem(
          accessToken: token,
          item: item,
          onUpdate: (_) {}, // No UI to update in background
        );
      } catch (_) {
        // Skip individual failures — try the rest
      }
    }

    await AutoBackupService.markBackupDone();
    return true;
  });
}
