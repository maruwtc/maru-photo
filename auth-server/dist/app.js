import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { UserRepository } from "./repositories/users.js";
import { DeviceRepository } from "./repositories/devices.js";
import { UploadRepository } from "./repositories/uploads.js";
import { AssetRepository } from "./repositories/assets.js";
import { MicrosoftAccountRepository } from "./repositories/microsoft-accounts.js";
import { AuditLogRepository } from "./repositories/audit-logs.js";
import { SystemSettingsRepository } from "./repositories/system-settings.js";
import { FirebaseService } from "./services/firebase.js";
import { AppTokenService } from "./services/app-token.js";
import { CryptoService } from "./services/crypto.js";
import { GraphService } from "./services/graph.js";
import { MicrosoftOAuthService } from "./services/microsoft-oauth.js";
import { MetricsService } from "./services/metrics.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/device.js";
import { uploadRoutes } from "./routes/uploads.js";
import { assetRoutes } from "./routes/assets.js";
import { adminUserRoutes } from "./routes/admin/users.js";
import { adminAssetRoutes } from "./routes/admin/assets.js";
import { adminAuditRoutes } from "./routes/admin/audit.js";
import { adminMetricsRoutes } from "./routes/admin/metrics.js";
import { adminSettingsRoutes } from "./routes/admin/settings.js";
export async function buildApp() {
    const config = loadConfig();
    const app = Fastify({
        logger: true,
        bodyLimit: 8 * 1024 * 1024
    });
    app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) => { done(null, body); });
    // ── Repositories ─────────────────────────────────────────────────────────────
    const db = createPool(config);
    const userRepository = new UserRepository(db);
    const deviceRepository = new DeviceRepository(db);
    const uploadRepository = new UploadRepository(db);
    const assetRepository = new AssetRepository(db);
    const microsoftAccountRepository = new MicrosoftAccountRepository(db);
    const auditLogRepository = new AuditLogRepository(db);
    const systemSettingsRepository = new SystemSettingsRepository(db);
    // ── Services ─────────────────────────────────────────────────────────────────
    const firebaseService = new FirebaseService(config);
    const appTokenService = new AppTokenService(config);
    const cryptoService = new CryptoService(config);
    const microsoftOAuthService = new MicrosoftOAuthService(config, cryptoService);
    const graphService = new GraphService(config, microsoftOAuthService);
    const metricsService = new MetricsService();
    // ── Plugins ──────────────────────────────────────────────────────────────────
    await app.register(sensible);
    await app.register(cors, {
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type", "Content-Range"],
        exposedHeaders: ["Content-Type"]
    });
    await app.register(authPlugin, { appTokenService });
    // ── Request metrics hook ─────────────────────────────────────────────────────
    app.addHook("onResponse", (request, reply, done) => {
        const route = `${request.method} ${request.routeOptions?.url ?? request.url.split("?")[0]}`;
        metricsService.record(route, reply.statusCode, reply.elapsedTime);
        done();
    });
    app.addHook("onClose", async () => { await db.end(); });
    // ── Core routes ──────────────────────────────────────────────────────────────
    await app.register(healthRoutes, { db });
    await app.register(authRoutes, {
        config,
        firebaseService,
        appTokenService,
        userRepository,
        microsoftOAuthService,
        microsoftAccountRepository,
        auditLogRepository
    });
    await app.register(deviceRoutes, { deviceRepository });
    await app.register(uploadRoutes, {
        config,
        deviceRepository,
        uploadRepository,
        assetRepository,
        microsoftAccountRepository,
        graphService,
        auditLogRepository
    });
    await app.register(assetRoutes, {
        assetRepository,
        microsoftAccountRepository,
        graphService
    });
    // ── Admin routes ─────────────────────────────────────────────────────────────
    await app.register(adminUserRoutes, { userRepository, auditLogRepository });
    await app.register(adminAssetRoutes, { assetRepository, auditLogRepository });
    await app.register(adminAuditRoutes, { auditLogRepository });
    await app.register(adminMetricsRoutes, { metricsService, db });
    await app.register(adminSettingsRoutes, { systemSettingsRepository, auditLogRepository });
    return { app, config };
}
