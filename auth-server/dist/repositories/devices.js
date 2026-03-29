export class DeviceRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async upsert(input) {
        const result = await this.db.query(`
        INSERT INTO devices (user_id, device_id, platform, app_version, push_token)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, device_id)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          app_version = EXCLUDED.app_version,
          push_token = EXCLUDED.push_token,
          updated_at = NOW()
        RETURNING id, device_id, platform, app_version
      `, [input.userId, input.deviceId, input.platform, input.appVersion, input.pushToken ?? null]);
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
    async findOwnedDevice(userId, deviceId) {
        const result = await this.db.query(`
        SELECT id, device_id, platform, app_version
        FROM devices
        WHERE user_id = $1 AND device_id = $2
      `, [userId, deviceId]);
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
