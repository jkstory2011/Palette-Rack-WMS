-- WMS 사용자 테이블
CREATE TABLE IF NOT EXISTS wms_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',   -- 'staff' | 'admin'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_approved   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  approved_by   TEXT
);

-- anon/authenticated 접근 차단 (service_role만 접근)
ALTER TABLE wms_users ENABLE ROW LEVEL SECURITY;
