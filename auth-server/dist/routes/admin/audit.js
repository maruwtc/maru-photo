export const adminAuditRoutes = async (fastify, options) => {
    const preHandler = [fastify.authenticate, fastify.requireAdmin];
    fastify.get("/v1/admin/audit-logs", { preHandler }, async (request) => {
        const { userId, action, resourceType, from, to, page, limit } = request.query;
        return options.auditLogRepository.list({
            userId,
            action,
            resourceType,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
            page: page ? Number(page) : 1,
            limit: limit ? Math.min(Number(limit), 200) : 50
        });
    });
};
