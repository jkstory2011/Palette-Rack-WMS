-- 오더 상태 관리 컬럼 추가 (보류·취소·재요청 사유)
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE inbound_orders  ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- 상태값 확장: on_hold | cancelled (기존 registered | instructed | completed 유지)
-- TEXT 타입이므로 별도 ENUM 변경 없이 바로 사용 가능
