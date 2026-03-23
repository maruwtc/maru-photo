import type { DbPool } from "../db.js";
import type { UploadSessionRecord } from "../types.js";

export class UploadRepository {
  constructor(private readonly db: DbPool) {}

  async create(input: {
    userId: string;
    deviceId: string;
    providerUploadUrl: string;
    graphItemPath: string;
    expectedBytes: number;
    chunkSize: number;
    fileName: string;
    mimeType: string;
    sha256: string;
    capturedAt: string | null;
    expiresAt: string;
  }): Promise<UploadSessionRecord> {
    const result = await this.db.query<{
      id: string;
      device_id: string;
      provider_upload_url: string;
      graph_item_path: string;
      expected_bytes: string;
      received_bytes: string;
      chunk_size: number;
      file_name: string;
      mime_type: string;
      sha256: string;
      captured_at: string | null;
      expires_at: string;
      status: UploadSessionRecord["status"];
    }>(
      `
        INSERT INTO upload_sessions (
          user_id,
          device_id,
          provider_upload_url,
          graph_item_path,
          expected_bytes,
          chunk_size,
          file_name,
          mime_type,
          sha256,
          captured_at,
          expires_at,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'initiated')
        RETURNING
          id,
          device_id,
          provider_upload_url,
          graph_item_path,
          expected_bytes,
          received_bytes,
          chunk_size,
          file_name,
          mime_type,
          sha256,
          captured_at,
          expires_at,
          status
      `,
      [
        input.userId,
        input.deviceId,
        input.providerUploadUrl,
        input.graphItemPath,
        input.expectedBytes,
        input.chunkSize,
        input.fileName,
        input.mimeType,
        input.sha256,
        input.capturedAt,
        input.expiresAt
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create upload session");
    }

    return {
      id: row.id,
      deviceUuid: row.device_id,
      providerUploadUrl: row.provider_upload_url,
      graphItemPath: row.graph_item_path,
      expectedBytes: Number(row.expected_bytes),
      receivedBytes: Number(row.received_bytes),
      chunkSize: row.chunk_size,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sha256: row.sha256,
      capturedAt: row.captured_at,
      expiresAt: row.expires_at,
      status: row.status
    };
  }

  async findOwnedUpload(uploadId: string, userId: string): Promise<UploadSessionRecord | null> {
    const result = await this.db.query<{
      id: string;
      device_id: string;
      provider_upload_url: string;
      graph_item_path: string;
      expected_bytes: string;
      received_bytes: string;
      chunk_size: number;
      file_name: string;
      mime_type: string;
      sha256: string;
      captured_at: string | null;
      expires_at: string;
      status: UploadSessionRecord["status"];
    }>(
      `
        SELECT
          id,
          device_id,
          provider_upload_url,
          graph_item_path,
          expected_bytes,
          received_bytes,
          chunk_size,
          file_name,
          mime_type,
          sha256,
          captured_at,
          expires_at,
          status
        FROM upload_sessions
        WHERE id = $1 AND user_id = $2
      `,
      [uploadId, userId]
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          deviceUuid: row.device_id,
          providerUploadUrl: row.provider_upload_url,
          graphItemPath: row.graph_item_path,
          expectedBytes: Number(row.expected_bytes),
          receivedBytes: Number(row.received_bytes),
          chunkSize: row.chunk_size,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sha256: row.sha256,
          capturedAt: row.captured_at,
          expiresAt: row.expires_at,
          status: row.status
        }
      : null;
  }

  async markChunkReceived(uploadId: string, bytesReceived: number): Promise<void> {
    await this.db.query(
      `
        UPDATE upload_sessions
        SET received_bytes = $2, status = 'uploading', updated_at = NOW()
        WHERE id = $1
      `,
      [uploadId, bytesReceived]
    );
  }

  async complete(uploadId: string): Promise<void> {
    await this.db.query(
      `
        UPDATE upload_sessions
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
      `,
      [uploadId]
    );
  }
}
