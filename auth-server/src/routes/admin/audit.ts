import type { FastifyPluginAsync } from "fastify";
import type { AuditLogRepository } from "../../repositories/audit-logs.js";

type Options = { auditLogRepository: AuditLogRepository };

export const adminAuditRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  const preHandler = [fastify.authenticate, fastify.requireAdmin];

  fastify.get<{
    Querystring: {
      userId?: string;
      action?: string;
      resourceType?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    };
  }>(
    "/v1/admin/audit-logs",
    { preHandler },
    async (request) => {
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
    }
  );
};
