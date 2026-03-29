export const adminUserRoutes = async (fastify, options) => {
    const preHandler = [fastify.authenticate, fastify.requireAdmin];
    fastify.get("/v1/admin/users", { preHandler }, async (request) => {
        return options.userRepository.list({
            page: Number(request.query.page ?? 1),
            limit: Number(request.query.limit ?? 20),
            search: request.query.search
        });
    });
    fastify.get("/v1/admin/users/:id", { preHandler }, async (request) => {
        const user = await options.userRepository.findById(request.params.id);
        if (!user)
            throw fastify.httpErrors.notFound("User not found");
        return user;
    });
    fastify.patch("/v1/admin/users/:id", { preHandler }, async (request) => {
        const actor = request.sessionUser;
        // Prevent self-demotion from admin
        if (request.params.id === actor.userId && request.body.isAdmin === false) {
            throw fastify.httpErrors.badRequest("Cannot remove your own admin status");
        }
        const user = await options.userRepository.update(request.params.id, request.body);
        if (!user)
            throw fastify.httpErrors.notFound("User not found");
        void options.auditLogRepository.log({
            userId: actor.userId,
            actorEmail: actor.email,
            action: "admin.user_update",
            resourceType: "user",
            resourceId: request.params.id,
            metadata: request.body,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
        });
        return user;
    });
    fastify.delete("/v1/admin/users/:id", { preHandler }, async (request, reply) => {
        const actor = request.sessionUser;
        if (request.params.id === actor.userId) {
            throw fastify.httpErrors.badRequest("Cannot delete your own account via admin API");
        }
        const deleted = await options.userRepository.delete(request.params.id);
        if (!deleted)
            throw fastify.httpErrors.notFound("User not found");
        void options.auditLogRepository.log({
            userId: actor.userId,
            actorEmail: actor.email,
            action: "admin.user_delete",
            resourceType: "user",
            resourceId: request.params.id,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"]
        });
        return reply.code(204).send();
    });
};
