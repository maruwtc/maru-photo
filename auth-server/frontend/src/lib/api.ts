const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function request<T>(token: string, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? `Request failed: ${res.status}`);
  return body as T;
}

export function createApi(token: string) {
  const r = <T>(path: string, opts?: RequestInit) => request<T>(token, path, opts);
  const qs = (params: Record<string, string | number | undefined>) =>
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");

  return {
    health: {
      ready: () => r<{ ok: boolean; uptime: number; db: { ok: boolean; latencyMs: number } }>(
        "/health/ready"
      ),
    },

    auth: {
      exchangeFirebaseToken: (idToken: string) =>
        request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
          "", "/v1/auth/firebase", { method: "POST", body: JSON.stringify({ idToken }) }
        ),
    },

    users: {
      list: (params: { page?: number; limit?: number; search?: string } = {}) =>
        r<{ total: number; users: import("@/types").UserRecord[] }>(
          `/v1/admin/users?${qs(params)}`
        ),
      getById: (id: string) => r<import("@/types").UserRecord>(`/v1/admin/users/${id}`),
      update: (id: string, patch: { isAdmin?: boolean; isDisabled?: boolean }) =>
        r<import("@/types").UserRecord>(`/v1/admin/users/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      delete: (id: string) => r<void>(`/v1/admin/users/${id}`, { method: "DELETE" }),
    },

    assets: {
      list: (params: { page?: number; limit?: number; userId?: string; mimeType?: string } = {}) =>
        r<{ total: number; assets: import("@/types").AssetRecord[] }>(
          `/v1/admin/assets?${qs(params)}`
        ),
      delete: (id: string) => r<void>(`/v1/admin/assets/${id}`, { method: "DELETE" }),
    },

    audit: {
      list: (params: {
        page?: number; limit?: number; userId?: string;
        action?: string; resourceType?: string; from?: string; to?: string;
      } = {}) =>
        r<{ total: number; logs: import("@/types").AuditLog[] }>(
          `/v1/admin/audit-logs?${qs(params)}`
        ),
    },

    metrics: {
      get: () => r<import("@/types").MetricsSnapshot>("/v1/admin/metrics"),
    },

    settings: {
      list: () => r<import("@/types").SystemSetting[]>("/v1/admin/settings"),
      get: (key: string) => r<import("@/types").SystemSetting>(`/v1/admin/settings/${key}`),
      upsert: (key: string, value: unknown, description?: string) =>
        r<import("@/types").SystemSetting>(`/v1/admin/settings/${key}`, {
          method: "PUT",
          body: JSON.stringify({ value, description }),
        }),
      delete: (key: string) => r<void>(`/v1/admin/settings/${key}`, { method: "DELETE" }),
    },
  };
}
