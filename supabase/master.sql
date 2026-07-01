-- ============================================================
-- Palette Rack WMS — Master Schema
-- 4,380평 / 4단 파렛트랙 / 혼적(1:N) / FIFO 출고
--
-- 신규 Supabase 프로젝트에서 이 파일 하나만 실행하면 됩니다.
-- Supabase Dashboard → SQL Editor → 붙여넣기 → Run
-- ============================================================


-- ──────────────────────────────────────────
-- 0. 확장
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────
-- 1. 구역 (zones)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id         SERIAL      PRIMARY KEY,
  code       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 2. 로케이션 (locations)
--    한 로케이션 = 4단 × 좌/우(L/R) = 최대 8 파렛트
--    slot_config: 'both'(기본) | 'L'(좌측만) | 'R'(우측만)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL      PRIMARY KEY,
  zone_id     INTEGER     NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  grid_x      SMALLINT    NOT NULL,
  grid_y      SMALLINT    NOT NULL,
  aisle       TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  slot_config TEXT        NOT NULL DEFAULT 'both',  -- 'both' | 'L' | 'R'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (zone_id, grid_x, grid_y)
);

CREATE INDEX IF NOT EXISTS idx_locations_zone_id ON locations(zone_id);
CREATE INDEX IF NOT EXISTS idx_locations_grid    ON locations(zone_id, grid_x, grid_y);


-- ──────────────────────────────────────────
-- 3. 상품 마스터 (products)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL      PRIMARY KEY,
  code          TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  unit          TEXT        NOT NULL DEFAULT 'EA',
  barcode       TEXT,
  client_name   TEXT,
  expiry_at     DATE,
  mgmt_location TEXT,
  box_qty       INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 4. 파렛트 (pallets)
--    status: stored | pending | outbound | shipped
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pallets (
  id               SERIAL      PRIMARY KEY,
  code             TEXT        NOT NULL UNIQUE,
  location_id      INTEGER     REFERENCES locations(id) ON DELETE SET NULL,
  tier             SMALLINT    CHECK (tier BETWEEN 1 AND 4),
  side             CHAR(1)     CHECK (side IN ('L', 'R')),
  status           TEXT        NOT NULL DEFAULT 'stored'
                               CHECK (status IN ('stored', 'pending', 'outbound', 'shipped')),
  inbound_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outbound_at      TIMESTAMPTZ,
  expiry_at        DATE,
  inbound_order_id INTEGER,    -- FK는 inbound_orders 생성 후 아래에서 추가
  note             TEXT
);

CREATE INDEX IF NOT EXISTS idx_pallets_location ON pallets(location_id) WHERE status = 'stored';
CREATE INDEX IF NOT EXISTS idx_pallets_inbound  ON pallets(inbound_at)  WHERE status = 'stored';
CREATE INDEX IF NOT EXISTS idx_pallets_status   ON pallets(status);

-- 활성 슬롯 중복 방지 (stored/pending만)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pallet_slot_active
  ON pallets (location_id, tier, side)
  WHERE status IN ('stored', 'pending');


-- ──────────────────────────────────────────
-- 5. 파렛트 혼적 아이템 (pallet_items)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pallet_items (
  id         SERIAL      PRIMARY KEY,
  pallet_id  INTEGER     NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
  product_id INTEGER     NOT NULL REFERENCES products(id),
  qty        INTEGER     NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (pallet_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pallet_items_pallet  ON pallet_items(pallet_id);
CREATE INDEX IF NOT EXISTS idx_pallet_items_product ON pallet_items(product_id);


-- ──────────────────────────────────────────
-- 6. 입고 이력 (inbound_logs)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_logs (
  id          SERIAL      PRIMARY KEY,
  pallet_id   INTEGER     NOT NULL REFERENCES pallets(id),
  location_id INTEGER     REFERENCES locations(id),
  tier        SMALLINT,
  side        CHAR(1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operator    TEXT,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbound_logs_pallet  ON inbound_logs(pallet_id);
CREATE INDEX IF NOT EXISTS idx_inbound_logs_created ON inbound_logs(created_at DESC);


-- ──────────────────────────────────────────
-- 7. 출고 이력 (outbound_logs)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_logs (
  id          SERIAL      PRIMARY KEY,
  pallet_id   INTEGER     NOT NULL REFERENCES pallets(id),
  location_id INTEGER     REFERENCES locations(id),
  tier        SMALLINT,
  side        CHAR(1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operator    TEXT,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_logs_pallet  ON outbound_logs(pallet_id);
CREATE INDEX IF NOT EXISTS idx_outbound_logs_created ON outbound_logs(created_at DESC);


-- ──────────────────────────────────────────
-- 8. 입고 오더 (inbound_orders)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_orders (
  id             SERIAL      PRIMARY KEY,
  order_no       TEXT        UNIQUE NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'registered',  -- registered | instructed | completed | on_hold | cancelled
  client_name    TEXT,
  scheduled_date DATE,
  pallet_count   INTEGER     NOT NULL DEFAULT 1,
  note           TEXT,
  status_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instructed_at  TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inbound_order_items (
  id             SERIAL  PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  qty_per_pallet INTEGER NOT NULL
);

-- 입고오더 FK 연결 (pallets 테이블이 먼저 생성된 후)
ALTER TABLE pallets
  ADD CONSTRAINT IF NOT EXISTS fk_pallets_inbound_order
  FOREIGN KEY (inbound_order_id) REFERENCES inbound_orders(id);


-- ──────────────────────────────────────────
-- 9. 출고 오더 (outbound_orders)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_orders (
  id             SERIAL      PRIMARY KEY,
  order_no       TEXT        UNIQUE NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'registered',
  client_name    TEXT,
  scheduled_date DATE,
  note           TEXT,
  status_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instructed_at  TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS outbound_order_items (
  id           SERIAL  PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  required_qty INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_order_pallets (
  id                SERIAL   PRIMARY KEY,
  order_id          INTEGER  NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  pallet_id         INTEGER  NOT NULL REFERENCES pallets(id),
  ship_qty          INTEGER  NOT NULL,
  is_partial        BOOLEAN  NOT NULL DEFAULT FALSE,
  location_snapshot TEXT,
  tier              SMALLINT,
  side              CHAR(1)
);


-- ──────────────────────────────────────────
-- 10. 생산 오더 (production_orders)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_orders (
  id             SERIAL      PRIMARY KEY,
  order_no       TEXT        UNIQUE NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'registered',  -- registered | in_progress | completed
  client_name    TEXT,
  scheduled_date DATE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS production_order_items (
  id           SERIAL  PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  target_qty   INTEGER NOT NULL,
  produced_qty INTEGER NOT NULL DEFAULT 0
);


-- ──────────────────────────────────────────
-- 11. 상품 로케이션 (product_locations)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_locations (
  id         SERIAL      PRIMARY KEY,
  code       TEXT        UNIQUE NOT NULL,
  name       TEXT        NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 12. WMS 사용자 (wms_users)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        UNIQUE NOT NULL,
  display_name  TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'staff',  -- 'staff' | 'admin'
  position      TEXT        NOT NULL DEFAULT '사용자',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  is_approved   BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  approved_by   TEXT
);


-- ──────────────────────────────────────────
-- 13. 화주사 (clients)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                   SERIAL      PRIMARY KEY,
  code                 TEXT        UNIQUE,
  name                 TEXT        NOT NULL UNIQUE,
  ceo                  TEXT,
  business_no          TEXT,
  email                TEXT,
  main_phone           TEXT,
  contact              TEXT,
  phone                TEXT,
  note                 TEXT,
  business_license_url TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 14. 직원 (employees)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id         SERIAL      PRIMARY KEY,
  emp_code   TEXT        UNIQUE,
  name       TEXT        NOT NULL,
  department TEXT,
  position   TEXT,
  phone      TEXT,
  email      TEXT,
  hire_date  DATE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 15. 편의 뷰 — 재고 현황 (v_stock)
-- ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_stock WITH (security_invoker = true) AS
SELECT
  l.zone_id,
  z.code       AS zone_code,
  l.id         AS location_id,
  l.code       AS location_code,
  l.grid_x,
  l.grid_y,
  p.id         AS pallet_id,
  p.code       AS pallet_code,
  p.tier,
  p.side,
  p.inbound_at,
  pi.product_id,
  pr.code      AS product_code,
  pr.name      AS product_name,
  pr.unit,
  pi.qty,
  ROW_NUMBER() OVER (
    PARTITION BY pi.product_id
    ORDER BY p.inbound_at ASC
  ) AS fifo_rank
FROM locations    l
JOIN zones        z  ON z.id  = l.zone_id
JOIN pallets      p  ON p.location_id = l.id AND p.status = 'stored'
JOIN pallet_items pi ON pi.pallet_id  = p.id
JOIN products     pr ON pr.id         = pi.product_id;

GRANT SELECT ON v_stock TO anon, authenticated;


-- ──────────────────────────────────────────
-- 16. RLS 설정
--     내부망 WMS: anon + authenticated 전체 허용
--     wms_users: service_role만 접근 (로그인 API 전용)
-- ──────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'zones','locations','products','pallets','pallet_items',
    'inbound_logs','outbound_logs',
    'inbound_orders','inbound_order_items',
    'outbound_orders','outbound_order_items','outbound_order_pallets',
    'production_orders','production_order_items',
    'product_locations','clients','employees'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "allow_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END $$;

-- wms_users는 service_role 전용 (RLS만 켜고 정책 없음 = anon 접근 차단)
ALTER TABLE wms_users ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────
-- 17. Realtime
-- ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE pallets;
ALTER PUBLICATION supabase_realtime ADD TABLE pallet_items;


-- ──────────────────────────────────────────
-- 18. 멀티테넌트 — 회사(companies) 테이블 및 company_id 컬럼
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL      PRIMARY KEY,
  code       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON companies;
CREATE POLICY "allow_all" ON companies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO companies (code, name) VALUES
  ('JK', '주식회사 제이케이스토리'),
  ('OML', '주식회사 오마이물류')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE wms_users        ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE zones             ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE products          ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE inbound_orders    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE outbound_orders   ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE clients           ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
ALTER TABLE employees         ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- 기존 데이터 → 제이케이스토리(id=1) 귀속
UPDATE zones             SET company_id = 1 WHERE company_id IS NULL;
UPDATE products          SET company_id = 1 WHERE company_id IS NULL;
UPDATE inbound_orders    SET company_id = 1 WHERE company_id IS NULL;
UPDATE outbound_orders   SET company_id = 1 WHERE company_id IS NULL;
UPDATE production_orders SET company_id = 1 WHERE company_id IS NULL;
UPDATE clients           SET company_id = 1 WHERE company_id IS NULL;
UPDATE employees         SET company_id = 1 WHERE company_id IS NULL;
UPDATE wms_users SET company_id = 1 WHERE company_id IS NULL AND role != 'superadmin';

-- superadmin 계정 (비밀번호: palette@super2024)
INSERT INTO wms_users (username, display_name, password_hash, role, is_approved, is_active, company_id)
VALUES (
  'superadmin', '시스템 관리자',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lB0W',
  'superadmin', true, true, NULL
)
ON CONFLICT (username) DO NOTHING;
