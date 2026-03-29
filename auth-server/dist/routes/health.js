export const healthRoutes = async (fastify, options) => {
    /** Basic liveness probe */
    fastify.get("/health", async () => ({ ok: true }));
    /** Detailed readiness probe — checks DB connectivity */
    fastify.get("/health/ready", async (_request, reply) => {
        let dbOk = false;
        let dbLatencyMs = -1;
        try {
            const start = Date.now();
            await options.db.query("SELECT 1");
            dbLatencyMs = Date.now() - start;
            dbOk = true;
        }
        catch {
            dbOk = false;
        }
        const mem = process.memoryUsage();
        const body = {
            ok: dbOk,
            uptime: Math.round(process.uptime()),
            db: { ok: dbOk, latencyMs: dbLatencyMs },
            memory: {
                heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
                rssMb: Math.round(mem.rss / 1024 / 1024)
            }
        };
        return reply.code(dbOk ? 200 : 503).send(body);
    });
};
