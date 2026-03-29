export class UserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async upsertFromFirebase(input) {
        const result = await this.db.query(`INSERT INTO users (firebase_uid, email, provider)
       VALUES ($1, $2, $3)
       ON CONFLICT (firebase_uid)
       DO UPDATE SET
         email      = EXCLUDED.email,
         provider   = EXCLUDED.provider,
         updated_at = NOW()
       RETURNING id, firebase_uid, email, is_admin, is_disabled`, [input.firebaseUid, input.email, input.provider]);
        const row = result.rows[0];
        if (!row)
            throw new Error("Failed to upsert user");
        return {
            userId: row.id,
            firebaseUid: row.firebase_uid,
            email: row.email,
            isAdmin: row.is_admin
        };
    }
    async findById(id) {
        const result = await this.db.query(`SELECT id, firebase_uid, email, provider, is_admin, is_disabled, created_at, updated_at
       FROM users WHERE id = $1`, [id]);
        const r = result.rows[0];
        if (!r)
            return null;
        return {
            id: r.id,
            firebaseUid: r.firebase_uid,
            email: r.email,
            provider: r.provider,
            isAdmin: r.is_admin,
            isDisabled: r.is_disabled,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        };
    }
    async list(opts = {}) {
        const page = opts.page ?? 1;
        const limit = Math.min(opts.limit ?? 20, 100);
        const offset = (page - 1) * limit;
        const params = [];
        let where = "";
        if (opts.search) {
            params.push(`%${opts.search.toLowerCase()}%`);
            where = `WHERE LOWER(u.email) LIKE $1`;
        }
        const countResult = await this.db.query(`SELECT COUNT(*) AS count FROM users u ${where}`, params);
        const total = Number(countResult.rows[0]?.count ?? 0);
        params.push(limit, offset);
        const rows = await this.db.query(`SELECT
         u.id, u.firebase_uid, u.email, u.provider, u.is_admin, u.is_disabled,
         u.created_at, u.updated_at,
         COUNT(DISTINCT a.id)  AS asset_count,
         COUNT(DISTINCT d.id)  AS device_count,
         (ma.id IS NOT NULL)   AS microsoft_connected
       FROM users u
       LEFT JOIN assets            a  ON a.user_id = u.id
       LEFT JOIN devices           d  ON d.user_id = u.id
       LEFT JOIN microsoft_accounts ma ON ma.user_id = u.id
       ${where}
       GROUP BY u.id, ma.id
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return {
            total,
            users: rows.rows.map((r) => ({
                id: r.id,
                firebaseUid: r.firebase_uid,
                email: r.email,
                provider: r.provider,
                isAdmin: r.is_admin,
                isDisabled: r.is_disabled,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                assetCount: Number(r.asset_count),
                deviceCount: Number(r.device_count),
                microsoftConnected: r.microsoft_connected
            }))
        };
    }
    async update(id, patch) {
        const sets = [];
        const params = [id];
        if (patch.isAdmin !== undefined) {
            params.push(patch.isAdmin);
            sets.push(`is_admin = $${params.length}`);
        }
        if (patch.isDisabled !== undefined) {
            params.push(patch.isDisabled);
            sets.push(`is_disabled = $${params.length}`);
        }
        if (sets.length === 0)
            return this.findById(id);
        sets.push("updated_at = NOW()");
        const result = await this.db.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1
       RETURNING id, firebase_uid, email, provider, is_admin, is_disabled, created_at, updated_at`, params);
        const r = result.rows[0];
        if (!r)
            return null;
        return {
            id: r.id,
            firebaseUid: r.firebase_uid,
            email: r.email,
            provider: r.provider,
            isAdmin: r.is_admin,
            isDisabled: r.is_disabled,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        };
    }
    async delete(id) {
        const result = await this.db.query(`DELETE FROM users WHERE id = $1`, [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async withTransaction(callback) {
        const client = await this.db.connect();
        try {
            await client.query("BEGIN");
            const result = await callback(client);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
}
