import type { DbPool } from "../db.js";

export class AssetRepository {
  constructor(private readonly db: DbPool) {}

  async create(input: {
    userId: string;
    deviceId: string;
    fileName: string;
    storagePath: string;
    driveId: string;
    driveItemId?: string | null;
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
          drive_item_id,
          sha256,
          mime_type,
          bytes,
          capture_time,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready')
        ON CONFLICT (user_id, sha256)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          storage_path = EXCLUDED.storage_path,
          drive_item_id = COALESCE(EXCLUDED.drive_item_id, assets.drive_item_id),
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
        input.driveItemId ?? null,
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

  async getByIdForUser(id: string, userId: string): Promise<{
    id: string;
    driveId: string;
    driveItemId: string | null;
    storagePath: string;
    mimeType: string;
  } | null> {
    const result = await this.db.query<{
      id: string;
      drive_id: string;
      drive_item_id: string | null;
      storage_path: string;
      mime_type: string;
    }>(
      `SELECT id, drive_id, drive_item_id, storage_path, mime_type
       FROM assets
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      driveId: row.drive_id,
      driveItemId: row.drive_item_id,
      storagePath: row.storage_path,
      mimeType: row.mime_type
    };
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM assets WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(opts: { page?: number | undefined; limit?: number | undefined; userId?: string | undefined; mimeType?: string | undefined } = {}): Promise<{
    total: number;
    assets: Array<{
      id: string; userId: string; fileName: string; mimeType: string;
      fileSize: number; capturedAt: string | null; status: string; createdAt: string;
    }>;
  }> {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.userId) { params.push(opts.userId); conditions.push(`user_id = $${params.length}`); }
    if (opts.mimeType) { params.push(`${opts.mimeType}%`); conditions.push(`mime_type LIKE $${params.length}`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM assets ${where}`, params
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    params.push(limit, offset);
    const rows = await this.db.query<{
      id: string; user_id: string; file_name: string; mime_type: string;
      bytes: string; capture_time: string | null; status: string; created_at: string;
    }>(
      `SELECT id, user_id, file_name, mime_type, bytes, capture_time, status, created_at
       FROM assets ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      total,
      assets: rows.rows.map((r) => ({
        id: r.id, userId: r.user_id, fileName: r.file_name, mimeType: r.mime_type,
        fileSize: Number(r.bytes), capturedAt: r.capture_time, status: r.status, createdAt: r.created_at
      }))
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
