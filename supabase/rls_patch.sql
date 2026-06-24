-- ============================================================
-- RLS 패치: anon 키로 모든 테이블 접근 허용 (내부망 WMS 전용)
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- ============================================================

-- 기존 authenticated 전용 정책 제거 후 anon + authenticated 모두 허용

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['zones','locations','products','pallets','pallet_items','inbound_logs','outbound_logs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_authenticated" ON %I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- v_stock 뷰는 별도 RLS 없이 SECURITY INVOKER로 재생성 (테이블 권한 상속)
DROP VIEW IF EXISTS v_stock;

CREATE OR REPLACE VIEW v_stock WITH (security_invoker = true) AS
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
    ORDER BY p.inbound_at ASC
  ) AS fifo_rank
FROM locations    l
JOIN zones        z  ON z.id  = l.zone_id
JOIN pallets      p  ON p.location_id = l.id AND p.status = 'stored'
JOIN pallet_items pi ON pi.pallet_id  = p.id
JOIN products     pr ON pr.id         = pi.product_id;

-- 뷰 SELECT 권한 부여
GRANT SELECT ON v_stock TO anon, authenticated;
