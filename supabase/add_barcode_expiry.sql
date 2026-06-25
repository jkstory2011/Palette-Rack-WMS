-- products 테이블에 바코드 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- pallets 테이블에 유통/취급기한 컬럼 추가
ALTER TABLE pallets ADD COLUMN IF NOT EXISTS expiry_at DATE;
