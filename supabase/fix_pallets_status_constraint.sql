-- pallets.status CHECK 제약 확장
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 제약 삭제
ALTER TABLE pallets DROP CONSTRAINT IF EXISTS pallets_status_check;

-- 2. 새 제약 추가 (pending·outbound 포함)
ALTER TABLE pallets
  ADD CONSTRAINT pallets_status_check
  CHECK (status IN ('stored', 'pending', 'outbound', 'shipped'));

-- 3. 슬롯 중복 방지 유니크 조건 재설정
--    stored / pending 상태만 슬롯을 점유, outbound 된 파렛트는 location_id = NULL 로 처리
--    기존 uq_pallet_slot 은 모든 상태에 적용되므로 조건부 인덱스로 교체
ALTER TABLE pallets DROP CONSTRAINT IF EXISTS uq_pallet_slot;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pallet_slot_active
  ON pallets (location_id, tier, side)
  WHERE status IN ('stored', 'pending');
