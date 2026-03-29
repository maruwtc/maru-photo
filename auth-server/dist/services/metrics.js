const MAX_RESPONSE_TIME_SAMPLES = 1000;
export class MetricsService {
    startTime = Date.now();
    requestCount = 0;
    errorCount = 0;
    requestsByRoute = new Map();
    responseTimes = [];
    record(routeKey, statusCode, durationMs) {
        this.requestCount++;
        if (statusCode >= 500)
            this.errorCount++;
        const prev = this.requestsByRoute.get(routeKey) ?? 0;
        this.requestsByRoute.set(routeKey, prev + 1);
        this.responseTimes.push(durationMs);
        if (this.responseTimes.length > MAX_RESPONSE_TIME_SAMPLES) {
            this.responseTimes.shift();
        }
    }
    snapshot() {
        const mem = process.memoryUsage();
        const sorted = [...this.responseTimes].sort((a, b) => a - b);
        const p = (pct) => {
            if (sorted.length === 0)
                return 0;
            return sorted[Math.floor(sorted.length * pct)] ?? sorted[sorted.length - 1] ?? 0;
        };
        const avg = sorted.length === 0 ? 0 : Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
        return {
            uptime: Math.round((Date.now() - this.startTime) / 1000),
            memory: {
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                rss: mem.rss,
                external: mem.external
            },
            requests: {
                total: this.requestCount,
                errors: this.errorCount,
                byRoute: Object.fromEntries(this.requestsByRoute)
            },
            responseTime: {
                p50: p(0.5),
                p90: p(0.9),
                p95: p(0.95),
                p99: p(0.99),
                avg
            }
        };
    }
}
