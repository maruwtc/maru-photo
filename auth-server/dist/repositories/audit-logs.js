export class AuditLogRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Fire-and-forget insert — errors are swallowed so they never break the main flow. */
    async log(input) {
        try {
            await this.db.query(`INSERT INTO audit_logs
           (user_id, actor_email, action, resource_type, resource_id, metadata, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
                input.userId ?? null,
                input.actorEmail ?? null,
                input.action,
                input.resourceType ?? null,
                input.resourceId ?? null,
                input.metadata ? JSON.stringify(input.metadata) : null,
                input.ipAddress ?? null,
                input.userAgent ?? null
            ]);
        }
        catch {
            // Never let audit failures crash the request
        }
    }
    async list(filters = {}) {
        const { page = 1, limit = 50 } = filters;
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        if (filters.userId) {
            params.push(filters.userId);
            conditions.push(`user_id = $${params.length}`);
        }
        if (filters.action) {
            params.push(filters.action);
            conditions.push(`action = $${params.length}`);
        }
        if (filters.resourceType) {
            params.push(filters.resourceType);
            conditions.push(`resource_type = $${params.length}`);
        }
        if (filters.from) {
            params.push(filters.from.toISOString());
            conditions.push(`created_at >= $${params.length}`);
        }
        if (filters.to) {
            params.push(filters.to.toISOString());
            conditions.push(`created_at <= $${params.length}`);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const countResult = await this.db.query(`SELECT COUNT(*) AS count FROM audit_logs ${where}`, params);
        const total = Number(countResult.rows[0]?.count ?? 0);
        params.push(limit, offset);
        const rows = await this.db.query(`SELECT id, user_id, actor_email, action, resource_type, resource_id,
              metadata, ip_address, user_agent, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        return {
            total,
            logs: rows.rows.map((r) => ({
                id: r.id,
                userId: r.user_id,
                actorEmail: r.actor_email,
                action: r.action,
                resourceType: r.resource_type,
                resourceId: r.resource_id,
                metadata: r.metadata,
                ipAddress: r.ip_address,
                userAgent: r.user_agent,
                createdAt: r.created_at
            }))
        };
    }
}
