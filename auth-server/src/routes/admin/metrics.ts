import type { FastifyPluginAsync } from "fastify";
import type { MetricsService } from "../../services/metrics.js";
import type { DbPool } from "../../db.js";

type Options = { metricsService: MetricsService; db: DbPool };

export const adminMetricsRoutes: FastifyPluginAsync<Options> = async (fastify, options) => {
  const preHandler = [fastify.authenticate, fastify.requireAdmin];

  fastify.get("/v1/admin/metrics", { preHandler }, async () => {
    const snapshot = options.metricsService.snapshot();

    // Enrich with live DB pool stats
    let dbStats: { totalConnections: number; idleConnections: number; waitingClients: number } | null = null;
    try {
      const pool = options.db as unknown as {
        totalCount: number; idleCount: number; waitingCount: number;
      };
      dbStats = {
        totalConnections: pool.totalCount ?? 0,
        idleConnections: pool.idleCount ?? 0,
        waitingClients: pool.waitingCount ?? 0
      };
    } catch {
      // pool stats not always available
    }

    return { ...snapshot, db: dbStats };
  });
};
