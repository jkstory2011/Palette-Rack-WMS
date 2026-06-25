-- ══════════════════════════════════════════════════
-- 3단계 워크플로우 테이블 추가
-- Supabase SQL Editor에서 실행하세요
-- ══════════════════════════════════════════════════

-- 1. 입고 오더 (입고등록 → 입고지시 → 입고완료)
CREATE TABLE IF NOT EXISTS inbound_orders (
  id             SERIAL PRIMARY KEY,
  order_no       TEXT UNIQUE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'registered',  -- registered | instructed | completed
  client_name    TEXT,
  scheduled_date DATE,
  pallet_count   INTEGER NOT NULL DEFAULT 1,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instructed_at  TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

-- 2. 입고 오더 상품 (1파렛트 기준 수량)
CREATE TABLE IF NOT EXISTS inbound_order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  qty_per_pallet INTEGER NOT NULL
);

-- 3. 출고 오더 (출고등록 → 출고지시 → 출고완료)
CREATE TABLE IF NOT EXISTS outbound_orders (
  id             SERIAL PRIMARY KEY,
  order_no       TEXT UNIQUE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'registered',  -- registered | instructed | completed
  client_name    TEXT,
  scheduled_date DATE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instructed_at  TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

-- 4. 출고 오더 상품
CREATE TABLE IF NOT EXISTS outbound_order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  required_qty   INTEGER NOT NULL
);

-- 5. 출고지시 파렛트 목록 (FIFO 선정 결과)
CREATE TABLE IF NOT EXISTS outbound_order_pallets (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  pallet_id         INTEGER NOT NULL REFERENCES pallets(id),
  ship_qty          INTEGER NOT NULL,
  is_partial        BOOLEAN NOT NULL DEFAULT FALSE,
  location_snapshot TEXT,
  tier              SMALLINT,
  side              CHAR(1)
);

-- 6. 생산 오더
CREATE TABLE IF NOT EXISTS production_orders (
  id             SERIAL PRIMARY KEY,
  order_no       TEXT UNIQUE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'registered',  -- registered | in_progress | completed
  client_name    TEXT,
  scheduled_date DATE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ
);

-- 7. 생산 오더 상품
CREATE TABLE IF NOT EXISTS production_order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  target_qty     INTEGER NOT NULL,
  produced_qty   INTEGER NOT NULL DEFAULT 0
);

-- 8. 파렛트에 입고오더 연결 (입고지시 시 생성된 파렛트 추적용)
ALTER TABLE pallets ADD COLUMN IF NOT EXISTS inbound_order_id INTEGER REFERENCES inbound_orders(id);

-- RLS 활성화
ALTER TABLE inbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;

-- 전체 허용 정책 (개발 단계)
CREATE POLICY "allow_all" ON inbound_orders  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inbound_order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON outbound_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON outbound_order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON outbound_order_pallets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON production_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON production_order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
