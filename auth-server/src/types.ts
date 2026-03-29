export type SessionUser = {
  userId: string;
  firebaseUid: string;
  email: string | null;
  isAdmin: boolean;
};

export type AppTokenPayload = {
  sub: string;
  firebaseUid: string;
  email: string | null;
  isAdmin: boolean;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
};

export type UserRecord = {
  id: string;
  firebaseUid: string;
  email: string | null;
  provider: string;
  isAdmin: boolean;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeviceRecord = {
  id: string;
  deviceId: string;
  platform: "ios" | "android";
  appVersion: string;
};

export type UploadSessionRecord = {
  id: string;
  deviceUuid: string;
  providerUploadUrl: string;
  graphItemPath: string;
  expectedBytes: number;
  receivedBytes: number;
  chunkSize: number;
  fileName: string;
  mimeType: string;
  sha256: string;
  capturedAt: string | null;
  expiresAt: string;
  status: "initiated" | "uploading" | "completed" | "expired" | "failed";
};

export type MicrosoftAccountRecord = {
  id: string;
  userId: string;
  microsoftUserId: string;
  email: string | null;
  displayName: string | null;
  encryptedRefreshToken: string;
  scope: string;
  tokenExpiresAt: string | null;
  driveId: string | null;
  driveType: string | null;
};

export type AuditLogRecord = {
  id: string;
  userId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type SystemSettingRecord = {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
};
