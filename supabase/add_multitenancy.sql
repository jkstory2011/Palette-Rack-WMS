-- ============================================================
-- 멀티테넌트(2개 회사) 마이그레이션
-- 기존 Supabase 프로젝트에서 한 번만 실행하세요.
-- ============================================================

-- 1. 회사 테이블
CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL      PRIMARY KEY,
  code       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON companies;
CREATE POLICY "allow_all" ON companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. 회사 2개 등록
INSERT INTO companies (code, name) VALUES
  ('JK', '주식회사 제이케이스토리'),
  ('OML', '주식회사 오마이물류')
ON CONFLICT (code) DO NOTHING;

-- 3. employees 테이블이 없으면 먼저 생성
CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  emp_code    TEXT UNIQUE,
  name        TEXT NOT NULL,
  department  TEXT,
  position    TEXT,
  phone       TEXT,
  email       TEXT,
  hire_date   DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON employees;
CREATE POLICY "allow_all" ON employees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. 주요 테이블에 company_id 추가
ALTER TABLE wms_users        ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE zones             ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE products          ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE inbound_orders    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE outbound_orders   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE clients           ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE employees         ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- 5. 기존 데이터 → 제이케이스토리(id=1) 귀속
UPDATE zones             SET company_id = 1 WHERE company_id IS NULL;
UPDATE products          SET company_id = 1 WHERE company_id IS NULL;
UPDATE inbound_orders    SET company_id = 1 WHERE company_id IS NULL;
UPDATE outbound_orders   SET company_id = 1 WHERE company_id IS NULL;
UPDATE production_orders SET company_id = 1 WHERE company_id IS NULL;
UPDATE clients           SET company_id = 1 WHERE company_id IS NULL;
UPDATE employees         SET company_id = 1 WHERE company_id IS NULL;
-- wms_users: superadmin은 NULL 유지, 나머지는 JK(1)로
UPDATE wms_users SET company_id = 1 WHERE company_id IS NULL AND role != 'superadmin';

-- 6. superadmin 계정 생성
--    비밀번호: palette@super2024 (아래 해시는 bcrypt 10 라운드)
INSERT INTO wms_users (username, display_name, password_hash, role, is_approved, is_active, company_id)
VALUES (
  'superadmin',
  '시스템 관리자',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lB0W',
  'superadmin',
  true,
  true,
  NULL
)
ON CONFLICT (username) DO NOTHING;
