-- products 테이블에 화주사명, 유통/취급기한 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_at   DATE;
