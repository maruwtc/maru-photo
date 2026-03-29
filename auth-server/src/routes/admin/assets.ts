import type { FastifyPluginAsync } from "fastify";
import type { AssetRepository } from "../../repositories/assets.js";
import type { AuditLogRepository } from "../../repositories/audit-logs.js";

type Options = { assetRepository: AssetRepository; auditLogRepository: AuditLogRepository };

export const adminAssetRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  const preHandler = [fastify.authenticate, fastify.requireAdmin];

  fastify.get<{ Querystring: { page?: string; limit?: string; userId?: string; mimeType?: string } }>(
    "/v1/admin/assets",
    { preHandler },
    async (request) => {
      return options.assetRepository.listAll({
        page: Number(request.query.page ?? 1),
        limit: Number(request.query.limit ?? 50),
        userId: request.query.userId,
        mimeType: request.query.mimeType
      });
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/v1/admin/assets/:id",
    { preHandler },
    async (request, reply) => {
      const actor = request.sessionUser!;
      const deleted = await options.assetRepository.deleteById(request.params.id);
      if (!deleted) throw fastify.httpErrors.notFound("Asset not found");

      void options.auditLogRepository.log({
        userId: actor.userId,
        actorEmail: actor.email,
        action: "admin.asset_delete",
        resourceType: "asset",
        resourceId: request.params.id,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      });

      return reply.code(204).send();
    }
  );
};
