-- 상품 로케이션 관리 테이블
CREATE TABLE IF NOT EXISTS product_locations (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON product_locations
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
