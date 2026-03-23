CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    email TEXT,
    provider TEXT NOT NULL DEFAULT 'google',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    app_version TEXT NOT NULL,
    push_token TEXT,
    last_backup_cursor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'microsoft-graph',
    storage_path TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    drive_item_id TEXT,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    capture_time TIMESTAMPTZ,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    bytes BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, sha256)
);

CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    provider_session_id TEXT,
    provider_upload_url TEXT NOT NULL,
    graph_item_path TEXT NOT NULL,
    expected_bytes BIGINT NOT NULL,
    received_bytes BIGINT NOT NULL DEFAULT 0,
    chunk_size INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    captured_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('initiated', 'uploading', 'completed', 'expired', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS microsoft_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    microsoft_user_id TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    encrypted_refresh_token TEXT NOT NULL,
    scope TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    drive_id TEXT,
    drive_type TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id_created_at ON assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id_status ON upload_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_microsoft_accounts_microsoft_user_id ON microsoft_accounts(microsoft_user_id);
