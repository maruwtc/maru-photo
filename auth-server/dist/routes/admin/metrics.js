export const adminMetricsRoutes = async (fastify, options) => {
    const preHandler = [fastify.authenticate, fastify.requireAdmin];
    fastify.get("/v1/admin/metrics", { preHandler }, async () => {
        const snapshot = options.metricsService.snapshot();
        // Enrich with live DB pool stats
        let dbStats = null;
        try {
            const pool = options.db;
            dbStats = {
                totalConnections: pool.totalCount ?? 0,
                idleConnections: pool.idleCount ?? 0,
                waitingClients: pool.waitingCount ?? 0
            };
        }
        catch {
            // pool stats not always available
        }
        return { ...snapshot, db: dbStats };
    });
};
