import fs from "node:fs";
import path from "node:path";

type RequiredConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  appJwtSecret: string;
  appJwtIssuer: string;
  appJwtAudience: string;
  authAllowedEmails: string[];
  authAllowedDomains: string[];
  graphTenantId: string;
  graphClientId: string;
  graphClientSecret: string;
  graphRedirectUri: string;
  graphScopes: string;
  graphSiteId: string;
  graphDriveId: string;
  graphRootFolder: string;
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
};

function loadDotEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readCsvEnv(name: string): string[] {
  const value = process.env[name];
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function loadConfig(): RequiredConfig {
  loadDotEnvFile();

  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    appJwtSecret: readRequiredEnv("APP_JWT_SECRET"),
    appJwtIssuer: readRequiredEnv("APP_JWT_ISSUER"),
    appJwtAudience: readRequiredEnv("APP_JWT_AUDIENCE"),
    authAllowedEmails: readCsvEnv("AUTH_ALLOWED_EMAILS"),
    authAllowedDomains: readCsvEnv("AUTH_ALLOWED_DOMAINS"),
    graphTenantId: readRequiredEnv("GRAPH_TENANT_ID"),
    graphClientId: readRequiredEnv("GRAPH_CLIENT_ID"),
    graphClientSecret: readRequiredEnv("GRAPH_CLIENT_SECRET"),
    graphRedirectUri: readRequiredEnv("GRAPH_REDIRECT_URI"),
    graphScopes: process.env.GRAPH_SCOPES ?? "offline_access openid profile email Files.ReadWrite",
    graphSiteId: process.env.GRAPH_SITE_ID ?? "",
    graphDriveId: process.env.GRAPH_DRIVE_ID ?? "",
    graphRootFolder: process.env.GRAPH_ROOT_FOLDER ?? "users",
    firebaseProjectId: readRequiredEnv("FIREBASE_PROJECT_ID"),
    firebaseClientEmail: readRequiredEnv("FIREBASE_CLIENT_EMAIL"),
    firebasePrivateKey: readRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")
  };
}

export type Config = ReturnType<typeof loadConfig>;
