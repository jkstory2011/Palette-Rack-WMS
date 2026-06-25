-- 상품 마스터 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE products ADD COLUMN IF NOT EXISTS mgmt_location TEXT;      -- 상품관리 로케이션
ALTER TABLE products ADD COLUMN IF NOT EXISTS box_qty       INTEGER;   -- BOX 내품수량
