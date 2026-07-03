# 작업 현황

마지막 갱신: 2026-07-03

맥북에서 `git pull origin main` 받으면 아래 상태가 최신입니다.

## 지금 다음에 할 일

**"개별 슬롯 사용 설정" 기능 — 구현 계획 수립부터 시작**

설계는 승인됐고([바로가기](specs/2026-07-03-individual-slot-toggle-design.md)), 아직 구현 계획서(plan)를 안 만든 상태. 다음 세션에서 "설계 문서 보고 구현 계획 짜줘" 또는 "개별 슬롯 기능 계획 수립해줘"라고 하면 이어서 진행 가능.

---

## ✅ 완료 (main에 병합, GitHub에 반영됨)

| 기능 | 설계 | 계획 | DB 변경 |
| --- | --- | --- | --- |
| 5분 무동작 자동 로그아웃 | [보기](specs/2026-07-03-idle-auto-logout-design.md) | [보기](plans/2026-07-03-idle-auto-logout.md) | 없음 |
| 직급별 관리권한 부여 | [보기](specs/2026-07-03-position-based-admin-permission-design.md) | [보기](plans/2026-07-03-position-based-admin-permission.md) | `wms_position_admin_grants` 테이블 추가 — **이미 Supabase에 적용 완료**, 양쪽 PC 모두 클라우드 DB 공유라 추가 조치 불필요 |

두 기능 모두: 구현 → 태스크별 리뷰 → 전체 통합 리뷰까지 전부 통과, main 브랜치에 푸시 완료. 코드 pull만 받으면 바로 최신 상태.

## 🚧 진행 중

| 기능 | 단계 | 남은 일 |
| --- | --- | --- |
| 개별 슬롯 사용 설정 | 설계 승인 완료 ([보기](specs/2026-07-03-individual-slot-toggle-design.md)) | 1) 구현 계획 수립 → 2) 구현 (태스크별 리뷰 포함) → 3) `locations.disabled_slots` 컬럼 Supabase에 수동 추가 필요 → 4) 통합 리뷰 → 5) main 푸시 |

**요약**: 이 기능은 랙 슬롯(단×좌우 칸)을 개별로 클릭해서 켜고 끌 수 있게 하는 기능. 기존 "좌측만/우측만/모두 사용" 프리셋은 그대로 두고, 그 안에서 특정 칸 하나만 더 세밀하게 끌 수 있게 하는 것.
