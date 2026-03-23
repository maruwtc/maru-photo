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
import { FirebaseService } from "./services/firebase.js";
import { AppTokenService } from "./services/app-token.js";
import { CryptoService } from "./services/crypto.js";
import { GraphService } from "./services/graph.js";
import { MicrosoftOAuthService } from "./services/microsoft-oauth.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/device.js";
import { uploadRoutes } from "./routes/uploads.js";
import { assetRoutes } from "./routes/assets.js";

export async function buildApp() {
  const config = loadConfig();
  const app = Fastify({
    logger: true,
    bodyLimit: 8 * 1024 * 1024
  });

  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    }
  );

  const db = createPool(config);
  const userRepository = new UserRepository(db);
  const deviceRepository = new DeviceRepository(db);
  const uploadRepository = new UploadRepository(db);
  const assetRepository = new AssetRepository(db);
  const microsoftAccountRepository = new MicrosoftAccountRepository(db);
  const firebaseService = new FirebaseService(config);
  const appTokenService = new AppTokenService(config);
  const cryptoService = new CryptoService(config);
  const microsoftOAuthService = new MicrosoftOAuthService(config, cryptoService);
  const graphService = new GraphService(config, microsoftOAuthService);

  await app.register(sensible);
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Content-Range"],
    exposedHeaders: ["Content-Type"]
  });
  await app.register(authPlugin, {
    appTokenService
  });

  app.addHook("onClose", async () => {
    await db.end();
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, {
    config,
    firebaseService,
    appTokenService,
    userRepository,
    microsoftOAuthService,
    microsoftAccountRepository
  });
  await app.register(deviceRoutes, {
    deviceRepository
  });
  await app.register(uploadRoutes, {
    config,
    deviceRepository,
    uploadRepository,
    assetRepository,
    microsoftAccountRepository,
    graphService
  });
  await app.register(assetRoutes, {
    assetRepository
  });

  return {
    app,
    config
  };
}
