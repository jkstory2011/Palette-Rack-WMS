# 작업 현황

마지막 갱신: 2026-07-03

맥북에서 `git pull origin main` 받으면 아래 상태가 최신입니다.

## 지금 다음에 할 일

**"로케이션 슬롯 바코드 라벨 + 입고 시 스캔 배정" 기능 — 구현부터 시작**

설계와 구현 계획 둘 다 완료됨 ([설계](specs/2026-07-03-slot-barcode-label-and-scan-assign-design.md), [계획](plans/2026-07-03-slot-barcode-label-and-scan-assign.md), 3개 태스크). 다음 세션에서 "이 계획대로 구현해줘" 또는 "서브에이전트 방식으로 진행해줘"라고 하면 이어서 진행 가능.

---

## ✅ 완료 (main에 병합, GitHub에 반영됨)

| 기능 | 설계 | 계획 | DB 변경 |
| --- | --- | --- | --- |
| 5분 무동작 자동 로그아웃 | [보기](specs/2026-07-03-idle-auto-logout-design.md) | [보기](plans/2026-07-03-idle-auto-logout.md) | 없음 |
| 직급별 관리권한 부여 | [보기](specs/2026-07-03-position-based-admin-permission-design.md) | [보기](plans/2026-07-03-position-based-admin-permission.md) | `wms_position_admin_grants` 테이블 추가 — **이미 Supabase에 적용 완료** |

두 기능 모두: 구현 → 태스크별 리뷰 → 전체 통합 리뷰까지 전부 통과, main 브랜치에 푸시 완료. 코드 pull만 받으면 바로 최신 상태.

## 🚧 진행 중 / 대기 중

| 기능 | 단계 | 남은 일 |
| --- | --- | --- |
| 로케이션 슬롯 바코드 라벨 + 스캔 배정 | 설계+계획 완료 ([설계](specs/2026-07-03-slot-barcode-label-and-scan-assign-design.md) / [계획](plans/2026-07-03-slot-barcode-label-and-scan-assign.md)) | 구현(3개 태스크: 라벨 컴포넌트 → locations 페이지 연결 → 입고지시 스캔 배정) → 리뷰 → main 푸시. **DB 변경 없음** |
| 개별 슬롯 사용 설정 | 설계 승인 완료 ([보기](specs/2026-07-03-individual-slot-toggle-design.md)) | 구현 계획 수립 → 구현 → `locations.disabled_slots` 컬럼 Supabase에 수동 추가 필요 → 리뷰 → main 푸시 |

**로케이션 슬롯 바코드 라벨**: 랙의 각 슬롯(예: `A-01-4L`)에 바코드 라벨을 출력해서 붙이고, 입고지시 단계에서 그 바코드를 스캔하면 자동 배정된 파렛트 위치를 원하는 슬롯으로 직접 바꿀 수 있게 하는 기능.

**개별 슬롯 사용 설정**: 랙 슬롯을 개별로 클릭해서 켜고 끌 수 있게 하는 기능 (기존 좌/우 프리셋과 병행).
