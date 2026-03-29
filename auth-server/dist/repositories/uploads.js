export class UploadRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(input) {
        const result = await this.db.query(`
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
      `, [
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
        ]);
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
    async findOwnedUpload(uploadId, userId) {
        const result = await this.db.query(`
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
      `, [uploadId, userId]);
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
    async markChunkReceived(uploadId, bytesReceived) {
        await this.db.query(`
        UPDATE upload_sessions
        SET received_bytes = $2, status = 'uploading', updated_at = NOW()
        WHERE id = $1
      `, [uploadId, bytesReceived]);
    }
    async complete(uploadId) {
        await this.db.query(`
        UPDATE upload_sessions
        SET status = 'completed', updated_at = NOW()
        WHERE id = $1
      `, [uploadId]);
    }
}
