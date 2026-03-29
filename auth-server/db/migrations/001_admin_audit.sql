-- Migration 001: Admin flags, audit log, system settings
-- Run this against an existing schema.sql database.

-- ── User flags ───────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_email   TEXT,
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource   ON audit_logs(resource_type, resource_id);

-- ── System settings (CMS key-value store) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL,
  description TEXT,
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed sensible defaults
INSERT INTO system_settings (key, value, description)
VALUES
  ('max_upload_size_mb',   '100',   'Maximum single-file upload size in megabytes'),
  ('quota_gb_per_user',    '50',    'Storage quota per user in gigabytes'),
  ('allowed_mime_types',   '["image/jpeg","image/png","image/heic","image/webp","video/mp4","video/quicktime"]', 'Accepted MIME types for upload'),
  ('maintenance_mode',     'false', 'When true, non-admin API calls return 503'),
  ('thumbnail_cache_ttl',  '3300',  'Thumbnail CDN URL cache TTL in seconds')
ON CONFLICT (key) DO NOTHING;
