-- ══════════════════════════════════════════════════
-- 마이그레이션 자동화 초기 설정 (딱 한 번만 실행)
-- Supabase SQL Editor에서 실행 후 더 이상 수동 실행 불필요
-- ══════════════════════════════════════════════════

-- 1. 적용된 마이그레이션 추적 테이블
CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SQL 실행 함수 (SECURITY DEFINER → 서비스롤 권한으로 DDL 실행)
CREATE OR REPLACE FUNCTION exec_migration(migration_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE migration_sql;
END;
$$;

-- 3. 이미 적용된 마이그레이션 기록 (기존에 수동으로 실행한 SQL들)
INSERT INTO _migrations (name) VALUES
  ('001_workflow_tables.sql'),
  ('002_order_status_actions.sql'),
  ('003_fix_pallets_status.sql'),
  ('004_product_fields.sql')
ON CONFLICT (name) DO NOTHING;
