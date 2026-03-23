import type { DbPool } from "../db.js";
import type { DeviceRecord } from "../types.js";

export class DeviceRepository {
  constructor(private readonly db: DbPool) {}

  async upsert(input: {
    userId: string;
    deviceId: string;
    platform: "ios" | "android";
    appVersion: string;
    pushToken?: string;
  }): Promise<DeviceRecord> {
    const result = await this.db.query<{
      id: string;
      device_id: string;
      platform: "ios" | "android";
      app_version: string;
    }>(
      `
        INSERT INTO devices (user_id, device_id, platform, app_version, push_token)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, device_id)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          app_version = EXCLUDED.app_version,
          push_token = EXCLUDED.push_token,
          updated_at = NOW()
        RETURNING id, device_id, platform, app_version
      `,
      [input.userId, input.deviceId, input.platform, input.appVersion, input.pushToken ?? null]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to upsert device");
    }

    return {
      id: row.id,
      deviceId: row.device_id,
      platform: row.platform,
      appVersion: row.app_version
    };
  }

  async findOwnedDevice(userId: string, deviceId: string): Promise<DeviceRecord | null> {
    const result = await this.db.query<{
      id: string;
      device_id: string;
      platform: "ios" | "android";
      app_version: string;
    }>(
      `
        SELECT id, device_id, platform, app_version
        FROM devices
        WHERE user_id = $1 AND device_id = $2
      `,
      [userId, deviceId]
    );

    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          deviceId: row.device_id,
          platform: row.platform,
          appVersion: row.app_version
        }
      : null;
  }
}
