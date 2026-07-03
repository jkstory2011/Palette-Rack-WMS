# 개별 슬롯 사용 설정 — 설계

## 배경

현재 랙(location)의 슬롯 사용 여부는 `slot_config`('both'/'L'/'R') 프리셋으로만 설정 가능하다 — 좌/우 어느 한쪽 전체를 켜고 끄는 것만 가능하고, 특정 단(tier)의 특정 칸 하나만 개별로 끌 수는 없다(예: 3단 우측 칸이 파손되어 그 칸만 못 쓰는 경우를 표현할 방법이 없음). 이 기능은 슬롯을 개별로 클릭해서 켜고 끌 수 있게 한다.

## 현재 구조 (참고)

- 랙 하나는 `TIERS = [4, 3, 2, 1]` × `SIDES = ['L', 'R']`로 최대 8개 슬롯을 가짐. 슬롯은 DB에 별도로 저장되지 않는 가상의 개념이며, `pallets` 테이블의 `(location_id, tier, side)` 조합으로 실제 점유 여부만 확인 가능
- `locations.slot_config`(TEXT, `'both'|'L'|'R'`)로 side 단위 사용 가능 여부를 결정, `availableSides(slot_config)` 함수가 이를 판단
- `availableSides`와 동일한 판단 로직이 `src/components/RackModal.js`, `src/app/inbound/page.js`(자동 입고 배정), `src/app/zone/[zoneCode]/page.js`(구역별 가용 슬롯 통계) 3곳에 중복 구현되어 있음
- `RackModal.js`는 `TierRow` → `SlotCell`(단×side당 1개, 최대 8개) 구조로 이미 각 슬롯을 개별 UI 요소로 렌더링 중이나, 현재 `SlotCell`은 파렛트 정보 표시 + 라벨 출력 버튼만 있고 클릭으로 뭔가를 바꾸는 기능은 없음
- `slot_config` 변경은 API 라우트 없이 클라이언트에서 Supabase를 직접 호출 (`supabase.from('locations').update({ slot_config: ... })`)
- 이 프로젝트는 자동 마이그레이션이 없어 스키마 변경은 `supabase/master.sql`을 사람이 Supabase SQL Editor에 직접 실행해야 함
- `pallets` 테이블은 `(location_id, tier, side)`에 대해 `status IN ('stored','pending')`인 경우 유니크 인덱스로 중복 점유를 막고 있음 — 슬롯 점유 여부의 근거(source of truth)

## 요구사항

1. 슬롯을 개별로 클릭해서 사용/사용안함을 즉시 토글할 수 있다 (확인 버튼 없이 클릭 즉시 반영)
2. 기존 `slot_config` 프리셋(좌/우 모두, 좌측만, 우측만)은 그대로 유지된다
3. 최종 판정: `프리셋이 해당 side를 허용 AND 그 슬롯이 개별적으로 꺼져있지 않음` — 개별 토글은 프리셋이 이미 꺼둔 side를 다시 켤 수 없고, 프리셋이 허용한 범위 안에서 "추가로 끄는" 용도로만 동작한다
4. 이미 파렛트가 보관 중인 슬롯은 개별로 끌 수 없다 (안내 메시지로 차단)
5. 자동 입고 배정 로직과 구역별 가용 슬롯 통계도 개별 토글을 반영해야 한다 (반영 안 하면 꺼진 슬롯에 자동 배정되는 버그가 됨)

## 데이터 모델

`locations` 테이블에 컬럼 추가:

```sql
ALTER TABLE locations ADD COLUMN IF NOT EXISTS disabled_slots JSONB NOT NULL DEFAULT '[]'::jsonb;
```

형식: `"{tier}-{side}"` 문자열의 배열, 예: `["3-R", "1-L"]`. 별도 테이블을 만들지 않고 `locations`의 한 컬럼으로 표현 — 슬롯이 별도 행(row)으로 존재하지 않는 기존 "가상 슬롯" 구조를 그대로 따르고, 기존 데이터 전체에 기본값(`[]`, 전부 사용 가능)이 자동 적용되어 별도 마이그레이션 스크립트 없이 안전하다.

## 공용 판단 로직 (`src/lib/rackSlots.js`)

현재 3곳에 중복된 `availableSides` 로직을 이 기회에 공용 모듈로 추출하고, 개별 토글 조건까지 포함한 최종 판정 함수를 새로 만든다:

```js
export function availableSides(slot_config) {
  if (slot_config === 'L') return ['L']
  if (slot_config === 'R') return ['R']
  return ['L', 'R']
}

export function slotKey(tier, side) {
  return `${tier}-${side}`
}

export function isSlotUsable(location, tier, side) {
  if (!availableSides(location.slot_config).includes(side)) return false
  const disabled = location.disabled_slots ?? []
  return !disabled.includes(slotKey(tier, side))
}
```

`RackModal.js`, `src/app/inbound/page.js`, `src/app/zone/[zoneCode]/page.js` 3곳 모두 이 함수를 가져다 쓰도록 교체한다 (각 파일에 독립적으로 구현되어 있던 side 판단 로직을 대체).

## UI/상호작용

- `RackModal.js`에 이미 있는 "설정" 패널 표시 상태(`showConfig`)를 재사용한다 — 이 상태가 `true`일 때(설정 패널이 펼쳐져 있을 때) 위쪽 슬롯 그리드의 각 `SlotCell`이 클릭 가능해지고, 클릭 시 해당 슬롯의 개별 사용/사용안함을 즉시 토글한다
- 토글 시 `supabase.from('locations').update({ disabled_slots: [...] }).eq('id', location.id)`로 배열 전체를 갱신 (JSONB 컬럼이라 부분 배열 조작 없이 클라이언트에서 새 배열을 만들어 통째로 저장)
- 슬롯에 파렛트가 있는 상태에서 클릭하면 토글하지 않고 `alert('보관 중인 파렛트가 있어 개별로 끌 수 없습니다.')`로 안내한다 (이 파일에는 기존에 토스트 시스템이 없으므로 네이티브 `alert()` 사용 — `RackModal.js`에서 이미 다른 곳에 쓰이는 패턴이 없다면 새로 만들지 않고 가장 단순한 방법을 씀)
- 프리셋으로 인해 이미 꺼진 슬롯(예: `slot_config='L'`일 때 R쪽 슬롯)은 클릭해도 아무 동작 하지 않는다(요구사항 3) — `alert('현재 프리셋에서 사용 불가능한 쪽입니다. 프리셋을 먼저 변경하세요.')`로 안내한다
- 개별로 꺼진 슬롯과 프리셋으로 꺼진 슬롯은 화면상 동일하게 "사용불가"로 표시한다 (이유를 구분해서 보여주는 UI는 만들지 않음 — 범위 밖)

## 반영 지점

- **`src/app/inbound/page.js`**: 자동 배정 시 `TIERS × usableSides`를 순회하며 빈 슬롯을 찾는 로직이 있음 — `isSlotUsable(location, tier, side)`로 교체해 개별로 꺼진 슬롯을 자동 배정 후보에서 제외한다
- **`src/app/zone/[zoneCode]/page.js`**: `slotCapacity(slot_config)`가 8/4를 반환하던 것을, 위치별로 `isSlotUsable`을 8칸에 대해 순회해 실제 사용 가능한 칸 수를 세는 방식으로 바꾼다 (개별로 꺼진 칸만큼 분모가 줄어듦)

## 엣지 케이스

| 상황 | 처리 |
| --- | --- |
| 슬롯에 파렛트가 있는 상태에서 개별 토글 클릭 | 토글하지 않고 안내 메시지 표시 |
| 프리셋으로 이미 꺼진 side의 슬롯 클릭 | 토글하지 않고 안내 메시지 표시 ("프리셋을 먼저 변경하세요") |
| 개별로 끈 슬롯이 있는 상태에서 프리셋을 바꿔서 그 side가 다시 열림 | `disabled_slots`는 그대로 유지됨 — 개별로 껐던 슬롯은 프리셋이 바뀌어도 계속 꺼진 채로 남음 (다시 켜려면 그 슬롯을 다시 클릭해야 함) |
| `disabled_slots` 컬럼이 없는 기존 DB(마이그레이션 전) | 클라이언트 조회 시 `location.disabled_slots`가 `undefined`이므로 `?? []`로 안전하게 처리 (기존 `slot_config` 컬럼 부재 시 폴백 패턴과 동일) |

## 범위 밖 (Out of scope)

- 개별로 꺼진 이유(파손/점검 등)를 메모로 남기는 기능은 포함하지 않음
- 개별 토글 이력(누가 언제 껐는지) 기록은 포함하지 않음
- 여러 슬롯을 한 번에 선택해서 일괄 토글하는 기능(다중 선택)은 포함하지 않음 — 클릭 시 즉시 토글로 확정
