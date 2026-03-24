import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';

import '../config/app_config.dart';
import '../models/app_models.dart';
import 'api_client.dart';

class UploadService {
  UploadService({
    required ApiClient apiClient,
  }) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<BackupQueueItem>> pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.media,
    );

    if (result == null) {
      return const [];
    }

    return result.files
        .where((file) => file.path != null)
        .map(
          (file) => BackupQueueItem(
            id: DateTime.now().microsecondsSinceEpoch.toString() + file.name,
            fileName: file.name,
            fileSize: file.size,
            localPath: file.path!,
            progress: 0,
            status: 'queued',
            message: 'Ready to upload',
          ),
        )
        .toList();
  }

  Future<List<AssetItem>> fetchAssets(String accessToken) async {
    final response = await _apiClient.get(
      '/v1/assets',
      accessToken: accessToken,
    ) as List<dynamic>;

    return response
        .cast<Map<String, dynamic>>()
        .map(
          (json) => AssetItem(
            id: json['id'] as String,
            fileName: json['fileName'] as String,
            mimeType: json['mimeType'] as String,
            fileSize: (json['fileSize'] as num).toInt(),
            status: json['status'] as String,
            capturedAt: json['capturedAt'] == null
                ? null
                : DateTime.tryParse(json['capturedAt'] as String),
          ),
        )
        .toList();
  }

  Future<void> uploadQueueItem({
    required String accessToken,
    required BackupQueueItem item,
    required void Function(BackupQueueItem item) onUpdate,
  }) async {
    final file = File(item.localPath);
    if (!await file.exists()) {
      throw const UploadFlowException('Selected file is no longer available on device.');
    }

    onUpdate(item.copyWith(status: 'hashing', message: 'Calculating SHA-256', progress: 0.08));
    final fileBytes = await file.readAsBytes();
    final sha256Hex = sha256.convert(fileBytes).toString();
    final mimeType = lookupMimeType(item.localPath) ?? 'application/octet-stream';

    onUpdate(item.copyWith(status: 'starting', message: 'Creating upload session', progress: 0.15));
    final initiate = await _apiClient.post(
      '/v1/uploads/initiate',
      accessToken: accessToken,
      body: {
        'deviceId': AppConfig.deviceId,
        'fileName': item.fileName,
        'fileSize': item.fileSize,
        'mimeType': mimeType,
        'sha256': sha256Hex,
        'capturedAt': DateTime.now().toIso8601String(),
      },
    ) as Map<String, dynamic>;

    final uploadId = initiate['uploadId'] as String;
    final chunkSize = (initiate['chunkSize'] as num).toInt();
    var start = 0;

    onUpdate(item.copyWith(status: 'uploading', message: 'Uploading chunks', progress: 0.2));
    while (start < fileBytes.length) {
      final endExclusive = (start + chunkSize).clamp(0, fileBytes.length);
      final chunk = fileBytes.sublist(start, endExclusive);
      final contentRange = 'bytes $start-${endExclusive - 1}/${fileBytes.length}';

      await _putChunk(
        path: '/v1/uploads/$uploadId/chunk',
        accessToken: accessToken,
        bytes: chunk,
        contentRange: contentRange,
      );

      start = endExclusive;
      final progress = 0.2 + ((start / fileBytes.length) * 0.72);
      onUpdate(
        item.copyWith(
          status: 'uploading',
          message: 'Uploaded ${_formatBytes(start)} of ${_formatBytes(fileBytes.length)}',
          progress: progress.clamp(0, 0.92),
        ),
      );
    }

    onUpdate(item.copyWith(status: 'finalizing', message: 'Completing upload', progress: 0.96));
    await _apiClient.post(
      '/v1/uploads/complete',
      accessToken: accessToken,
      body: {
        'uploadId': uploadId,
      },
    );

    onUpdate(item.copyWith(status: 'done', message: 'Upload complete', progress: 1));
  }

  Future<void> _putChunk({
    required String path,
    required String accessToken,
    required List<int> bytes,
    required String contentRange,
  }) async {
    final uri = Uri.parse('${_apiClient.baseUrl}$path');
    final response = await http.put(
      uri,
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/octet-stream',
        'Content-Range': contentRange,
      },
      body: bytes,
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Chunk upload failed';
      if (response.body.isNotEmpty) {
        try {
          final decoded = jsonDecode(response.body);
          if (decoded is Map<String, dynamic>) {
            message = decoded['message']?.toString() ?? message;
          }
        } catch (_) {
          message = response.body;
        }
      }
      throw UploadFlowException(message);
    }
  }
}

String _formatBytes(int bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return '${value.toStringAsFixed(unitIndex == 0 ? 0 : 1)} ${units[unitIndex]}';
}

class UploadFlowException implements Exception {
  const UploadFlowException(this.message);

  final String message;

  @override
  String toString() => message;
}
