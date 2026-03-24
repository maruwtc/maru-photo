class AppSession {
  const AppSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
}

class DeviceInfo {
  const DeviceInfo({
    required this.id,
    required this.deviceId,
    required this.platform,
    required this.appVersion,
  });

  final String id;
  final String deviceId;
  final String platform;
  final String appVersion;
}

class MicrosoftStatus {
  const MicrosoftStatus({
    required this.connected,
    this.email,
    this.displayName,
    this.driveType,
  });

  final bool connected;
  final String? email;
  final String? displayName;
  final String? driveType;
}

class AssetItem {
  const AssetItem({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.fileSize,
    required this.status,
    this.capturedAt,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int fileSize;
  final String status;
  final DateTime? capturedAt;
}

class BackupQueueItem {
  const BackupQueueItem({
    required this.id,
    required this.fileName,
    required this.fileSize,
    required this.localPath,
    required this.progress,
    required this.status,
    required this.message,
  });

  final String id;
  final String fileName;
  final int fileSize;
  final String localPath;
  final double progress;
  final String status;
  final String message;

  BackupQueueItem copyWith({
    double? progress,
    String? status,
    String? message,
  }) {
    return BackupQueueItem(
      id: id,
      fileName: fileName,
      fileSize: fileSize,
      localPath: localPath,
      progress: progress ?? this.progress,
      status: status ?? this.status,
      message: message ?? this.message,
    );
  }
}
