-- ============================================================
-- Palette Rack WMS — Supabase Schema
-- 4,380평 / 4단 파렛트랙 / 혼적(1:N) / FIFO 출고
-- ============================================================

-- ──────────────────────────────────────────
-- 0. 확장
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()


-- ──────────────────────────────────────────
-- 1. 구역 (zones)
--    창고를 논리 구역으로 나눔 (A동, B동, 냉동 등)
-- ──────────────────────────────────────────
CREATE TABLE zones (
  id         SERIAL       PRIMARY KEY,
  code       TEXT         NOT NULL UNIQUE,   -- 'A', 'B', 'COLD'
  name       TEXT         NOT NULL,          -- '일반 구역', '냉동 구역'
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 2. 로케이션 (locations)
--    창고 바닥의 랙 한 열(Column) = 하나의 로케이션
--    grid_x: 격자 X 좌표(열), grid_y: 격자 Y 좌표(행)
--    한 로케이션 = 4단 × 좌/우(L/R) = 최대 8 파렛트
-- ──────────────────────────────────────────
CREATE TABLE locations (
  id         SERIAL       PRIMARY KEY,
  zone_id    INTEGER      NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  code       TEXT         NOT NULL UNIQUE,   -- 'A-01', 'A-02', 'B-03'
  grid_x     SMALLINT     NOT NULL,          -- 격자 열 (1-based)
  grid_y     SMALLINT     NOT NULL,          -- 격자 행 (1-based)
  aisle      TEXT,                           -- 통로 구분 ('1번 통로')
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (zone_id, grid_x, grid_y)           -- 같은 구역 내 좌표 중복 불가
);

CREATE INDEX idx_locations_zone_id ON locations(zone_id);
CREATE INDEX idx_locations_grid    ON locations(zone_id, grid_x, grid_y);


-- ──────────────────────────────────────────
-- 3. 상품 마스터 (products)
-- ──────────────────────────────────────────
CREATE TABLE products (
  id         SERIAL       PRIMARY KEY,
  code       TEXT         NOT NULL UNIQUE,   -- 상품코드 (바코드)
  name       TEXT         NOT NULL,          -- 상품명
  unit       TEXT         NOT NULL DEFAULT 'EA',  -- 단위
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────
-- 4. 파렛트 (pallets)
--    물리적 파렛트 한 장 = 하나의 행
--    location_id + tier + side 로 정확한 슬롯 특정
--    inbound_at 으로 FIFO 정렬 기준 제공
-- ──────────────────────────────────────────
CREATE TABLE pallets (
  id           SERIAL       PRIMARY KEY,
  code         TEXT         NOT NULL UNIQUE, -- 바코드 값 'PLT-20240624-001'
  location_id  INTEGER      REFERENCES locations(id) ON DELETE SET NULL,
  tier         SMALLINT     CHECK (tier BETWEEN 1 AND 4),  -- 단 (1 = 최하단, 4 = 최상단)
  side         CHAR(1)      CHECK (side IN ('L', 'R')),    -- 좌(L) / 우(R)
  status       TEXT         NOT NULL DEFAULT 'stored'
                            CHECK (status IN ('stored', 'shipped')),
  inbound_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),         -- FIFO 기준
  outbound_at  TIMESTAMPTZ,                                 -- 출고 처리 일시
  note         TEXT,

  -- 재고 중인 파렛트만 슬롯 중복 방지 (출고된 건 NULL이라 중복 허용)
  CONSTRAINT uq_pallet_slot UNIQUE NULLS NOT DISTINCT (location_id, tier, side)
);

CREATE INDEX idx_pallets_location  ON pallets(location_id) WHERE status = 'stored';
CREATE INDEX idx_pallets_inbound   ON pallets(inbound_at)  WHERE status = 'stored';
CREATE INDEX idx_pallets_status    ON pallets(status);


-- ──────────────────────────────────────────
-- 5. 파렛트 혼적 아이템 (pallet_items)  ← 1:N 핵심 테이블
--    파렛트 하나에 여러 상품이 섞여 있을 수 있음
-- ──────────────────────────────────────────
CREATE TABLE pallet_items (
  id         SERIAL       PRIMARY KEY,
  pallet_id  INTEGER      NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
  product_id INTEGER      NOT NULL REFERENCES products(id),
  qty        INTEGER      NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (pallet_id, product_id)  -- 동일 파렛트에 동일 상품 중복 행 방지
);

CREATE INDEX idx_pallet_items_pallet   ON pallet_items(pallet_id);
CREATE INDEX idx_pallet_items_product  ON pallet_items(product_id);


-- ──────────────────────────────────────────
-- 6. 입고 이력 (inbound_logs)
-- ──────────────────────────────────────────
CREATE TABLE inbound_logs (
  id           SERIAL       PRIMARY KEY,
  pallet_id    INTEGER      NOT NULL REFERENCES pallets(id),
  location_id  INTEGER      REFERENCES locations(id),
  tier         SMALLINT,
  side         CHAR(1),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  operator     TEXT,        -- 작업자 이름/ID
  note         TEXT
);

CREATE INDEX idx_inbound_logs_pallet   ON inbound_logs(pallet_id);
CREATE INDEX idx_inbound_logs_created  ON inbound_logs(created_at DESC);


-- ──────────────────────────────────────────
-- 7. 출고 이력 (outbound_logs)
--    FIFO 출고 시 파렛트 단위로 기록
-- ──────────────────────────────────────────
CREATE TABLE outbound_logs (
  id           SERIAL       PRIMARY KEY,
  pallet_id    INTEGER      NOT NULL REFERENCES pallets(id),
  location_id  INTEGER      REFERENCES locations(id),  -- 출고 당시 위치 스냅샷
  tier         SMALLINT,
  side         CHAR(1),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  operator     TEXT,
  note         TEXT
);

CREATE INDEX idx_outbound_logs_pallet   ON outbound_logs(pallet_id);
CREATE INDEX idx_outbound_logs_created  ON outbound_logs(created_at DESC);


-- ──────────────────────────────────────────
-- 8. 편의 뷰 — 재고 현황 (v_stock)
--    locations + pallets + pallet_items 조인
--    입고 순 정렬 포함 (FIFO 안내에 활용)
-- ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_stock AS
SELECT
  l.zone_id,
  z.code          AS zone_code,
  l.id            AS location_id,
  l.code          AS location_code,
  l.grid_x,
  l.grid_y,
  p.id            AS pallet_id,
  p.code          AS pallet_code,
  p.tier,
  p.side,
  p.inbound_at,
  pi.product_id,
  pr.code         AS product_code,
  pr.name         AS product_name,
  pr.unit,
  pi.qty,
  ROW_NUMBER() OVER (
    PARTITION BY pi.product_id
    ORDER BY p.inbound_at ASC           -- FIFO: 가장 먼저 입고된 것 = 1번
  )               AS fifo_rank
FROM locations       l
JOIN zones           z  ON z.id  = l.zone_id
JOIN pallets         p  ON p.location_id = l.id AND p.status = 'stored'
JOIN pallet_items    pi ON pi.pallet_id  = p.id
JOIN products        pr ON pr.id         = pi.product_id;


-- ──────────────────────────────────────────
-- 9. RLS (Row Level Security) 기본 활성화
--    실제 정책은 운영 정책에 따라 추가
-- ──────────────────────────────────────────
ALTER TABLE zones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallet_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_logs ENABLE ROW LEVEL SECURITY;

-- 개발 단계: 인증된 사용자 전체 허용 (운영 전 세분화 필요)
CREATE POLICY "allow_all_authenticated" ON zones         FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON locations     FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON products      FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON pallets       FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON pallet_items  FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON inbound_logs  FOR ALL TO authenticated USING (true);
CREATE POLICY "allow_all_authenticated" ON outbound_logs FOR ALL TO authenticated USING (true);


-- ──────────────────────────────────────────
-- 10. Realtime 발행 테이블 등록
-- ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE pallets;
ALTER PUBLICATION supabase_realtime ADD TABLE pallet_items;


-- ============================================================
-- 샘플 데이터 (개발/테스트용)
-- ============================================================

INSERT INTO zones (code, name) VALUES
  ('A', 'A동 일반구역'),
  ('B', 'B동 일반구역'),
  ('C', 'C동 냉동구역');

-- A구역: 4열 × 3행 = 12개 로케이션
INSERT INTO locations (zone_id, code, grid_x, grid_y, aisle) VALUES
  (1, 'A-01', 1, 1, '1번 통로'), (1, 'A-02', 2, 1, '1번 통로'),
  (1, 'A-03', 3, 1, '1번 통로'), (1, 'A-04', 4, 1, '1번 통로'),
  (1, 'A-05', 1, 2, '2번 통로'), (1, 'A-06', 2, 2, '2번 통로'),
  (1, 'A-07', 3, 2, '2번 통로'), (1, 'A-08', 4, 2, '2번 통로'),
  (1, 'A-09', 1, 3, '3번 통로'), (1, 'A-10', 2, 3, '3번 통로'),
  (1, 'A-11', 3, 3, '3번 통로'), (1, 'A-12', 4, 3, '3번 통로');

INSERT INTO products (code, name, unit) VALUES
  ('PRD-001', '삼다수 2L 6입', 'BOX'),
  ('PRD-002', '코카콜라 355ml 24캔', 'BOX'),
  ('PRD-003', '신라면 5입 멀티팩', 'BOX'),
  ('PRD-004', '참치캔 150g 3입', 'SET');

-- 파렛트 샘플 (A-01 로케이션: 혼적 + 단일 혼합)
INSERT INTO pallets (code, location_id, tier, side, inbound_at) VALUES
  ('PLT-20240601-001', 1, 1, 'L', '2024-06-01 09:00:00+09'),  -- A-01 1단 좌
  ('PLT-20240601-002', 1, 1, 'R', '2024-06-01 09:30:00+09'),  -- A-01 1단 우
  ('PLT-20240602-003', 1, 2, 'L', '2024-06-02 10:00:00+09'),  -- A-01 2단 좌
  ('PLT-20240610-004', 1, 3, 'L', '2024-06-10 14:00:00+09');  -- A-01 3단 좌

-- 혼적: PLT-001 에 2가지 상품
INSERT INTO pallet_items (pallet_id, product_id, qty) VALUES
  (1, 1, 50),   -- PLT-001: 삼다수 50박스
  (1, 2, 30);   -- PLT-001: 코카콜라 30박스 (혼적)

-- 단일: PLT-002
INSERT INTO pallet_items (pallet_id, product_id, qty) VALUES
  (2, 3, 100);  -- PLT-002: 신라면 100박스

-- 단일: PLT-003
INSERT INTO pallet_items (pallet_id, product_id, qty) VALUES
  (3, 4, 60);   -- PLT-003: 참치캔 60세트

-- 혼적: PLT-004 에 3가지 상품
INSERT INTO pallet_items (pallet_id, product_id, qty) VALUES
  (4, 1, 20),
  (4, 3, 15),
  (4, 4, 10);
