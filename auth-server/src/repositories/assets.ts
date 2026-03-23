import type { DbPool } from "../db.js";

export class AssetRepository {
  constructor(private readonly db: DbPool) {}

  async create(input: {
    userId: string;
    deviceId: string;
    fileName: string;
    storagePath: string;
    driveId: string;
    sha256: string;
    mimeType: string;
    bytes: number;
    capturedAt: string | null;
  }): Promise<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    capturedAt: string | null;
    status: "processing" | "ready" | "failed";
  }> {
    const result = await this.db.query<{
      id: string;
      file_name: string;
      mime_type: string;
      bytes: string;
      capture_time: string | null;
      status: "processing" | "ready" | "failed";
    }>(
      `
        INSERT INTO assets (
          user_id,
          device_id,
          file_name,
          storage_path,
          drive_id,
          sha256,
          mime_type,
          bytes,
          capture_time,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')
        ON CONFLICT (user_id, sha256)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          storage_path = EXCLUDED.storage_path,
          mime_type = EXCLUDED.mime_type,
          bytes = EXCLUDED.bytes,
          capture_time = EXCLUDED.capture_time,
          status = 'ready',
          updated_at = NOW()
        RETURNING id, file_name, mime_type, bytes, capture_time, status
      `,
      [
        input.userId,
        input.deviceId,
        input.fileName,
        input.storagePath,
        input.driveId,
        input.sha256,
        input.mimeType,
        input.bytes,
        input.capturedAt
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create asset");
    }

    return {
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSize: Number(row.bytes),
      capturedAt: row.capture_time,
      status: row.status
    };
  }

  async listByUser(userId: string): Promise<
    Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      capturedAt: string | null;
      status: "processing" | "ready" | "failed";
    }>
  > {
    const result = await this.db.query<{
      id: string;
      file_name: string;
      mime_type: string;
      bytes: string;
      capture_time: string | null;
      status: "processing" | "ready" | "failed";
    }>(
      `
        SELECT id, file_name, mime_type, bytes, capture_time, status
        FROM assets
        WHERE user_id = $1
        ORDER BY capture_time DESC NULLS LAST, created_at DESC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSize: Number(row.bytes),
      capturedAt: row.capture_time,
      status: row.status
    }));
  }
}
