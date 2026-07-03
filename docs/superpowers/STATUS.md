# 작업 현황

마지막 갱신: 2026-07-03

맥북에서 `git pull origin main` 받으면 아래 상태가 최신입니다.

## 완료 (main에 병합·배포 반영됨)

### 5분 무동작 자동 로그아웃
- 로그인 후 5분간 활동 없으면 자동 로그아웃, 4분 시점에 경고 모달 표시
- 설계: [specs/2026-07-03-idle-auto-logout-design.md](specs/2026-07-03-idle-auto-logout-design.md)
- 계획: [plans/2026-07-03-idle-auto-logout.md](plans/2026-07-03-idle-auto-logout.md)
- 상태: 구현 완료, 리뷰 통과, main에 푸시 완료

### 직급별 관리권한 부여
- 회사별로 어떤 직급이 관리자 권한을 갖는지 `admin/users` 페이지에서 체크박스로 설정
- 설계: [specs/2026-07-03-position-based-admin-permission-design.md](specs/2026-07-03-position-based-admin-permission-design.md)
- 계획: [plans/2026-07-03-position-based-admin-permission.md](plans/2026-07-03-position-based-admin-permission.md)
- 상태: 구현 완료, 리뷰 통과(보안 하드닝 1건 추가 반영), main에 푸시 완료
- **DB 변경 있었음**: `wms_position_admin_grants` 테이블 — 이미 Supabase에 적용됨 (양쪽 PC 모두 클라우드 DB 공유라 추가 작업 불필요)

## 진행 중

### 개별 슬롯 사용 설정
- 랙의 슬롯(단×좌우)을 개별로 클릭해서 사용/사용안함 토글 (기존 좌/우 프리셋과 병행)
- 설계: [specs/2026-07-03-individual-slot-toggle-design.md](specs/2026-07-03-individual-slot-toggle-design.md) — **설계 승인 완료**
- 계획: 아직 작성 전 (다음 단계: 구현 계획 수립 → 구현)
- **DB 변경 예정**: `locations.disabled_slots` 컬럼 추가 필요 (아직 미실행)
