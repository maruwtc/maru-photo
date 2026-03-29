export const adminSettingsRoutes = async (fastify, options) => {
    const preHandler = [fastify.authenticate, fastify.requireAdmin];
    fastify.get("/v1/admin/settings", { preHandler }, async () => {
        return options.systemSettingsRepository.list();
    });
    fastify.get("/v1/admin/settings/:key", { preHandler }, async (request) => {
        const setting = await options.systemSettingsRepository.get(request.params.key);
        if (!setting)
            throw fastify.httpErrors.notFound("Setting not found");
        return setting;
    });
    fastify.put("/v1/admin/settings/:key", { preHandler }, async (request) => {
        const actor = request.sessionUser;
        const setting = await options.systemSettingsRepository.upsert(request.params.key, request.body.value, actor.userId, request.body.description);
        void options.auditLogRepository.log({
            userId: actor.userId,
            actorEmail: actor.email,
            action: "admin.setting_update",
            resourceType: "system_setting",
            resourceId: request.params.key,
            metadata: { value: request.body.value },
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
        });
        return setting;
    });
    fastify.delete("/v1/admin/settings/:key", { preHandler }, async (request, reply) => {
        const actor = request.sessionUser;
        const deleted = await options.systemSettingsRepository.delete(request.params.key);
        if (!deleted)
            throw fastify.httpErrors.notFound("Setting not found");
        void options.auditLogRepository.log({
            userId: actor.userId,
            actorEmail: actor.email,
            action: "admin.setting_delete",
            resourceType: "system_setting",
            resourceId: request.params.key,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
        });
        return reply.code(204).send();
    });
};
