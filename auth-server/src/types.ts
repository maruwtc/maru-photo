export type SessionUser = {
  userId: string;
  firebaseUid: string;
  email: string | null;
};

export type AppTokenPayload = {
  sub: string;
  firebaseUid: string;
  email: string | null;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
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
