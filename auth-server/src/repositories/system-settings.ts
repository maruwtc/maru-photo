import type { DbPool } from "../db.js";
import type { SystemSettingRecord } from "../types.js";

export class SystemSettingsRepository {
  constructor(private readonly db: DbPool) {}

  async list(): Promise<SystemSettingRecord[]> {
    const result = await this.db.query<{
      key: string;
      value: unknown;
      description: string | null;
      updated_by: string | null;
      updated_at: string;
    }>(`SELECT key, value, description, updated_by, updated_at
        FROM system_settings
        ORDER BY key`);

    return result.rows.map((r) => ({
      key: r.key,
      value: r.value,
      description: r.description,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at
    }));
  }

  async get(key: string): Promise<SystemSettingRecord | null> {
    const result = await this.db.query<{
      key: string;
      value: unknown;
      description: string | null;
      updated_by: string | null;
      updated_at: string;
    }>(
      `SELECT key, value, description, updated_by, updated_at
       FROM system_settings WHERE key = $1`,
      [key]
    );
    const r = result.rows[0];
    if (!r) return null;
    return { key: r.key, value: r.value, description: r.description, updatedBy: r.updated_by, updatedAt: r.updated_at };
  }

  async upsert(key: string, value: unknown, updatedBy: string, description?: string): Promise<SystemSettingRecord> {
    const result = await this.db.query<{
      key: string;
      value: unknown;
      description: string | null;
      updated_by: string | null;
      updated_at: string;
    }>(
      `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value      = EXCLUDED.value,
         description = COALESCE($3, system_settings.description),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING key, value, description, updated_by, updated_at`,
      [key, JSON.stringify(value), description ?? null, updatedBy]
    );
    const r = result.rows[0]!;
    return { key: r.key, value: r.value, description: r.description, updatedBy: r.updated_by, updatedAt: r.updated_at };
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM system_settings WHERE key = $1`, [key]);
    return (result.rowCount ?? 0) > 0;
  }
}
