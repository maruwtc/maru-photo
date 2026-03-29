import 'package:photo_manager/photo_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

/// Handles persistent auto-backup state and WorkManager scheduling.
/// All methods are static so they can be called from both the foreground app
/// and the background WorkManager isolate.
class AutoBackupService {
  AutoBackupService._();

  static const _kEnabled = 'auto_backup_enabled';
  static const _kLastBackupMs = 'auto_backup_last_ms';
  static const _kToken = 'auto_backup_token';

  /// Unique name for the periodic WorkManager task.
  static const taskName = 'maruphoto_periodic_backup';

  // ── Persistence ────────────────────────────────────────────────────────────

  static Future<bool> isEnabled() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_kEnabled) ?? false;
  }

  static Future<void> saveToken(String token) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kToken, token);
  }

  static Future<String?> getSavedToken() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_kToken);
  }

  static Future<DateTime?> getLastBackupTime() async {
    final p = await SharedPreferences.getInstance();
    final ms = p.getInt(_kLastBackupMs);
    return ms != null ? DateTime.fromMillisecondsSinceEpoch(ms) : null;
  }

  static Future<void> markBackupDone() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt(_kLastBackupMs, DateTime.now().millisecondsSinceEpoch);
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────

  static Future<void> enable(String accessToken) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, true);
    await p.setString(_kToken, accessToken);

    await Workmanager().registerPeriodicTask(
      taskName,
      taskName,
      frequency: const Duration(hours: 1),
      initialDelay: const Duration(seconds: 10),
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }

  static Future<void> disable() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kEnabled, false);
    await Workmanager().cancelByUniqueName(taskName);
  }

  // ── Device photo access ────────────────────────────────────────────────────

  /// Request access to the device photo library.
  static Future<PermissionState> requestPermission() {
    return PhotoManager.requestPermissionExtend();
  }

  /// Returns device photos created after the last backup timestamp, capped at 50
  /// per run to avoid background task timeouts.
  static Future<List<AssetEntity>> getNewDevicePhotos() async {
    final lastBackup = await getLastBackupTime();
    final cutoff = lastBackup ?? DateTime.fromMillisecondsSinceEpoch(0);

    final filter = FilterOptionGroup(
      imageOption: const FilterOption(needTitle: true),
      videoOption: const FilterOption(needTitle: true),
      createTimeCond: DateTimeCond(min: cutoff, max: DateTime.now()),
      orders: [const OrderOption(type: OrderOptionType.createDate, asc: false)],
    );

    final albums = await PhotoManager.getAssetPathList(
      type: RequestType.common,
      filterOption: filter,
    );

    if (albums.isEmpty) return const [];
    return albums.first.getAssetListRange(start: 0, end: 50);
  }
}
