export type UserRecord = {
  id: string;
  firebaseUid: string;
  email: string | null;
  provider: string;
  isAdmin: boolean;
  isDisabled: boolean;
  assetCount?: number;
  deviceCount?: number;
  microsoftConnected?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssetRecord = {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  capturedAt: string | null;
  status: string;
  createdAt: string;
};

export type AuditLog = {
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

export type SystemSetting = {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

export type MetricsSnapshot = {
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number; external: number };
  requests: { total: number; errors: number; byRoute: Record<string, number> };
  responseTime: { p50: number; p90: number; p95: number; p99: number; avg: number };
  db: { totalConnections: number; idleConnections: number; waitingClients: number } | null;
};

export type PaginatedResponse<T> = {
  total: number;
  users?: T[];
  assets?: T[];
  logs?: T[];
};
