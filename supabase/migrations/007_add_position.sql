-- wms_users 에 직급 컬럼 추가
ALTER TABLE wms_users ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '사용자';
