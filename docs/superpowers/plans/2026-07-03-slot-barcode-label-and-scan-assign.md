# 로케이션 슬롯 바코드 라벨 + 입고 시 스캔 배정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랙(location)의 각 슬롯(단×좌우)에 대해 바코드가 포함된 라벨을 출력할 수 있게 하고, 입고지시 단계에서 그 바코드를 스캔해서 파렛트를 특정 슬롯에 직접 배정할 수 있게 한다.

**Architecture:** 슬롯 식별자는 `{location.code}-{tier}{side}` 형식(예: `A-01-4L`)으로 인쇄 시점에만 생성되는 문자열이며 DB에 저장되지 않는다. 출력은 기존 `LabelPrinter.js`의 self-contained 포털+스타일 패턴을 재사용한 새 컴포넌트로, 스캔은 기존에 이미 만들어져 있지만 미사용 상태인 `BarcodeInput` 컴포넌트를 입고지시 모달의 배정 테이블에 붙여서 구현한다.

**Tech Stack:** Next.js 14 App Router, `jsbarcode`(CODE128), 기존 `BarcodeInput`/`supabase` 클라이언트 직접 호출. 새 npm 패키지 없음, 새 DB 컬럼/테이블 없음.

## Global Constraints

- 슬롯 코드 형식: `{location.code}-{tier}{side}` (예: `A-01-4L`), 파싱 정규식: `/^(.+)-(\d)([LR])$/`
- 라벨 출력은 랙 단위로 한 번에 — `slot_config`가 허용하는 side만 대상 (최대 8개, `slot_config='L'`이면 4개, `slot_config='R'`이면 4개)
- 바코드는 CODE128, 기존 파렛트 라벨과 동일한 `jsbarcode` 사용법(`JsBarcode(svgEl, value, {...})`, `useRef`+`useEffect`)을 따름
- 입고지시 단계의 기존 자동 배정 로직(`handleZoneChange`)은 그대로 유지, 스캔은 배정된 개별 줄을 덮어쓰는 추가 기능
- 스캔 판정 우선순위: ① 코드 형식 오류 → ② 존재하지 않는/비활성 로케이션 → ③ `slot_config`가 허용하지 않는 side → ④ 이번 배치 내 중복 → ⑤ DB상 이미 점유된 슬롯 → 모두 통과해야 배정 교체
- 이 프로젝트에는 자동화 테스트 프레임워크가 없음 — 검증은 `npm run dev` + webapp-testing(Playwright) 스킬 또는 curl/node 스크립트로 진행
- `/api` 라우트가 없는 프로젝트 관례를 따름 — 모든 DB 접근은 클라이언트에서 `supabase` 직접 호출

---

### Task 1: `LocationLabelPrinter` 컴포넌트 (슬롯 라벨 출력)

**Files:**
- Create: `src/components/LocationLabelPrinter.js`

**Interfaces:**
- Produces: `LocationLabelPrinter` — default export, props `{ location: { code, slot_config }, onClose: () => void }`. Task 2가 이 컴포넌트를 `location` 객체(랙 1개)와 함께 렌더링한다.

- [ ] **Step 1: `src/components/LocationLabelPrinter.js` 작성**

```jsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'

const TIERS = [4, 3, 2, 1]
const SIDES = ['L', 'R']

function availableSides(slot_config) {
  if (slot_config === 'L') return ['L']
  if (slot_config === 'R') return ['R']
  return SIDES
}

function buildSlots(location) {
  const sides = availableSides(location.slot_config)
  const slots = []
  for (const tier of TIERS) {
    for (const side of sides) {
      slots.push({ tier, side, slotCode: `${location.code}-${tier}${side}` })
    }
  }
  return slots
}

function drawBarcode(svgEl, code) {
  JsBarcode(svgEl, code, {
    format: 'CODE128', width: 2.2, height: 72,
    displayValue: true, fontSize: 14, margin: 8,
    background: '#ffffff', lineColor: '#000000',
  })
}

export default function LocationLabelPrinter({ location, onClose }) {
  const slots = buildSlots(location)
  const [current, setCurrent] = useState(0)
  const [mounted, setMounted] = useState(false)
  const previewRef = useRef(null)
  const printRef   = useRef(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (previewRef.current && slots[current]) drawBarcode(previewRef.current, slots[current].slotCode)
  }, [current, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (printRef.current && slots[current]) drawBarcode(printRef.current, slots[current].slotCode)
  }, [current, mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePrint() {
    window.print()
  }

  if (slots.length === 0) {
    return (
      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="text-gray-700 mb-4">출력 가능한 슬롯이 없습니다.</p>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-700 text-white font-semibold">
            닫기
          </button>
        </div>
      </div>
    )
  }

  const slot = slots[current]

  const printPortal = mounted ? createPortal(
    <div id="wms-slot-label-print">
      <SlotLabelContent location={location} slot={slot} barcodeRef={printRef} />
    </div>,
    document.body
  ) : null

  return (
    <>
      <style>{`
        #wms-slot-label-print { display: none; }
        @media print {
          body > *:not(#wms-slot-label-print) { display: none !important; }
          #wms-slot-label-print {
            display: block !important;
            position: fixed;
            top: 0; left: 0;
            width: 100%; min-height: 100vh;
            background: white !important;
            color: black !important;
            padding: 32px;
            font-family: ui-monospace, monospace;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="no-print fixed inset-0 z-[60] flex items-center justify-center
                      bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="text-gray-800 font-bold text-lg mb-1 text-center">🏷 슬롯 라벨 출력</h3>
          <p className="text-gray-400 text-xs text-center mb-4">{current + 1} / {slots.length}개</p>

          <SlotLabelContent location={location} slot={slot} barcodeRef={previewRef} />

          <div className="flex gap-2 mt-4">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800
                         font-semibold text-sm disabled:opacity-40">
              ← 이전
            </button>
            <button onClick={() => setCurrent(c => Math.min(slots.length - 1, c + 1))}
              disabled={current === slots.length - 1}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800
                         font-semibold text-sm disabled:opacity-40">
              다음 →
            </button>
          </div>

          <div className="flex gap-3 mt-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600
                         hover:bg-gray-100 font-medium transition-colors">
              취소
            </button>
            <button onClick={handlePrint}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white font-bold transition-colors">
              🖨 인쇄
            </button>
          </div>
        </div>
      </div>

      {printPortal}
    </>
  )
}

function SlotLabelContent({ location, slot, barcodeRef }) {
  return (
    <div style={{
      border: '2px solid black',
      borderRadius: 8,
      padding: 16,
      fontFamily: 'ui-monospace, monospace',
      color: 'black',
      background: 'white',
      maxWidth: 320,
    }}>
      <div style={{
        textAlign: 'center', fontSize: 11, fontWeight: 700,
        borderBottom: '1px solid black', paddingBottom: 6, marginBottom: 8,
        letterSpacing: '0.1em',
      }}>
        PALETTE RACK WMS
      </div>

      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
        {slot.slotCode}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <svg ref={barcodeRef} />
      </div>

      <div style={{ fontSize: 12, textAlign: 'center', color: '#444' }}>
        {location.code} · {slot.tier}단 · {slot.side === 'L' ? '좌측' : '우측'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 수동 검증 (webapp-testing 스킬로 실제 렌더링/바코드 값 확인)**

이 컴포넌트는 아직 어디서도 렌더링되지 않으므로(Task 2에서 연결됨), 임시로 검증용 페이지를 만들어 확인한다.

`D:\Palette Rack WMS\src\app\dev-test-label\page.js` 파일을 임시로 만든다 (검증 후 반드시 삭제):

```jsx
'use client'
import { useState } from 'react'
import LocationLabelPrinter from '@/components/LocationLabelPrinter'

export default function DevTestLabel() {
  const [open, setOpen] = useState(true)
  const testLocation = { code: 'A-01', slot_config: 'both' }
  return open ? <LocationLabelPrinter location={testLocation} onClose={() => setOpen(false)} /> : <button onClick={() => setOpen(true)}>다시 열기</button>
}
```

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

webapp-testing 스킬로 `http://localhost:3000/dev-test-label` 접속해서 확인:
1. "1 / 8개" (8슬롯: 4단 × 좌우)가 표시되고, 라벨에 "A-01-4L" 같은 슬롯 코드와 바코드 SVG가 그려지는지
2. "다음 →" 클릭 시 "2 / 8개"로 넘어가고 슬롯 코드가 "A-01-4R"(같은 4단의 우측)로 바뀌는지 — TIERS가 `[4,3,2,1]` 내림차순이고 안쪽 루프가 side(`['L','R']`)이므로 순서는 4L, 4R, 3L, 3R, 2L, 2R, 1L, 1R이어야 함
3. `testLocation.slot_config`를 `'L'`로 바꿔서 새로고침 — "1 / 4개"로 줄고 전부 `...L` 슬롯만 나오는지 확인

- [ ] **Step 3: 임시 검증 페이지 삭제**

```bash
rm "D:\Palette Rack WMS\src\app\dev-test-label\page.js"
rmdir "D:\Palette Rack WMS\src\app\dev-test-label" 2>/dev/null || true
```

- [ ] **Step 4: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/components/LocationLabelPrinter.js
git commit -m "feat: 로케이션 슬롯 바코드 라벨 출력 컴포넌트 추가"
```

---

### Task 2: `locations` 페이지에 "라벨 출력" 버튼 연결

**Files:**
- Modify: `src/app/locations/page.js`

**Interfaces:**
- Consumes: `LocationLabelPrinter` (Task 1, `@/components/LocationLabelPrinter`), props `{ location: { code, slot_config }, onClose }`

- [ ] **Step 1: import 추가**

`src/app/locations/page.js` 5번째 줄(`import { useCompany } from '@/context/CompanyContext'`) 바로 아래에 추가:

```js
import LocationLabelPrinter from '@/components/LocationLabelPrinter'
```

- [ ] **Step 2: `fetchLocations`의 select에 `slot_config` 추가**

`PalletLocationTab` 내부의 기존 코드:

```js
const { data } = await supabase.from('locations')
  .select('id, code, grid_x, grid_y, aisle, is_active, pallets(id, status)')
  .eq('zone_id', id).order('grid_y').order('grid_x')
```

이렇게 교체 (`slot_config` 추가):

```js
const { data } = await supabase.from('locations')
  .select('id, code, grid_x, grid_y, aisle, is_active, slot_config, pallets(id, status)')
  .eq('zone_id', id).order('grid_y').order('grid_x')
```

- [ ] **Step 3: `printLocation` 상태 추가**

`PalletLocationTab`의 기존 state 선언들(`const [selectedIds, setSelectedIds] = useState(new Set())` 근처) 바로 아래에 추가:

```js
const [printLocation, setPrintLocation] = useState(null)
```

- [ ] **Step 4: 정상(비-편집) 표시 행의 액션 셀에 라벨 출력 버튼 추가**

기존 코드 (정상 표시 행의 마지막 `<td>`):

```jsx
<td className="py-2.5 text-right whitespace-nowrap">
  <button onClick={() => startEdit(l)}
    className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
  <button onClick={() => handleDelete(l)}
    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
</td>
```

이렇게 교체 (라벨 출력 버튼을 맨 앞에 추가):

```jsx
<td className="py-2.5 text-right whitespace-nowrap">
  <button onClick={() => setPrintLocation(l)}
    className="text-xs text-gray-600 hover:text-blue-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">🏷 라벨</button>
  <button onClick={() => startEdit(l)}
    className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
  <button onClick={() => handleDelete(l)}
    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
</td>
```

- [ ] **Step 5: 모달 렌더링 추가**

`PalletLocationTab`이 반환하는 JSX의 최상위 컨테이너 안, 다른 모달/오버레이가 있다면 그 옆에 (없다면 return 블록의 최상위 `<div>`의 마지막 자식으로) 추가:

```jsx
{printLocation && (
  <LocationLabelPrinter location={printLocation} onClose={() => setPrintLocation(null)} />
)}
```

- [ ] **Step 6: 수동 검증 (webapp-testing 스킬)**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

`.env.local`의 `SITE_PASSWORD`로 개발관리자 로그인 후:
1. `/locations` 접속, "구역별 로케이션" 탭에서 구역 선택 후 로케이션 목록이 나오는지 확인
2. 아무 로케이션 행에 마우스를 올려서 "🏷 라벨" 버튼이 보이는지, 클릭 시 `LocationLabelPrinter` 모달이 뜨고 그 로케이션의 `code`로 슬롯 코드(예: 그 행의 코드가 "B-03"이면 "B-03-4L")가 표시되는지 확인
3. 그 로케이션의 `slot_config`가 좌측만/우측만으로 설정된 경우, 모달에 4개(8개 아님)만 나오는지 확인 — 미리 한 로케이션의 슬롯 설정을 좌측만으로 바꿔두고 테스트

- [ ] **Step 7: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/app/locations/page.js
git commit -m "feat: locations 페이지에 슬롯 라벨 출력 버튼 연결"
```

---

### Task 3: 입고지시 단계에 스캔으로 슬롯 직접 지정

**Files:**
- Modify: `src/app/inbound/page.js`

**Interfaces:**
- Consumes: `BarcodeInput` (기존 컴포넌트, `@/components/BarcodeInput`), props `{ value, onChange, onScan, placeholder, className }`

- [ ] **Step 1: import 추가**

`src/app/inbound/page.js` 7번째 줄(`import { useCompany } from '@/context/CompanyContext'`) 바로 아래에 추가:

```js
import BarcodeInput from '@/components/BarcodeInput'
```

- [ ] **Step 2: `InstructModal`에 스캔 입력 상태 추가**

`InstructModal` 함수 내부, 기존 state 선언들 바로 아래(`const [done, setDone] = useState(false)` 다음)에 추가:

```js
const [scanValues, setScanValues] = useState({})   // { [rowIndex]: 입력 중인 텍스트 }
```

- [ ] **Step 3: `handleSlotScan` 함수 추가**

`handleZoneChange` 함수(296~350번째 줄) 바로 다음, `handleConfirm` 함수 시작 전에 추가:

```js
async function handleSlotScan(i, code) {
  setError('')
  const trimmed = code.trim()
  const m = trimmed.match(/^(.+)-(\d)([LR])$/)
  if (!m) {
    setError('올바른 슬롯 코드가 아닙니다. (예: A-01-4L)')
    return
  }
  const [, locationCode, tierStr, side] = m
  const tier = Number(tierStr)

  const { data: loc, error: locErr } = await supabase
    .from('locations').select('id, code, slot_config, is_active')
    .eq('code', locationCode).maybeSingle()

  if (locErr || !loc || !loc.is_active) {
    setError('존재하지 않는 로케이션입니다.')
    return
  }

  const usableSides = loc.slot_config === 'L' ? ['L'] : loc.slot_config === 'R' ? ['R'] : SIDES
  if (!usableSides.includes(side)) {
    setError('이 랙에서 사용할 수 없는 슬롯입니다.')
    return
  }

  const dupInBatch = assignment.some((s, idx) =>
    idx !== i && s.locationId === loc.id && s.tier === tier && s.side === side
  )
  if (dupInBatch) {
    setError('이미 이번 배치에서 사용 중인 슬롯입니다.')
    return
  }

  const { data: occupied } = await supabase
    .from('pallets').select('id')
    .eq('location_id', loc.id).eq('tier', tier).eq('side', side)
    .in('status', ['stored', 'pending']).maybeSingle()

  if (occupied) {
    setError('이미 사용 중인 슬롯입니다.')
    return
  }

  setAssignment(prev => prev.map((s, idx) =>
    idx === i ? { locationId: loc.id, locationCode: loc.code, tier, side } : s
  ))
  setScanValues(prev => ({ ...prev, [i]: '' }))
}
```

- [ ] **Step 4: 배정 테이블에 스캔 열 추가**

기존 테이블 헤더:

```jsx
<tr className="text-gray-400">
  <th className="px-3 py-2 text-left">#</th>
  <th className="px-3 py-2 text-left">파렛트코드</th>
  <th className="px-3 py-2 text-left">로케이션</th>
  <th className="px-3 py-2 text-center">단</th>
  <th className="px-3 py-2 text-center">좌/우</th>
</tr>
```

이렇게 교체 (마지막에 "직접 지정" 열 추가):

```jsx
<tr className="text-gray-400">
  <th className="px-3 py-2 text-left">#</th>
  <th className="px-3 py-2 text-left">파렛트코드</th>
  <th className="px-3 py-2 text-left">로케이션</th>
  <th className="px-3 py-2 text-center">단</th>
  <th className="px-3 py-2 text-center">좌/우</th>
  <th className="px-3 py-2 text-left">직접 지정</th>
</tr>
```

기존 테이블 바디의 각 행:

```jsx
{assignment.map((slot, i) => (
  <tr key={i} className="hover:bg-gray-800/40">
    <td className="px-3 py-2 text-gray-600">{i + 1}</td>
    <td className="px-3 py-2 font-mono text-[#F59E0B]">{palletCodes[i]}</td>
    <td className="px-3 py-2 font-bold text-white">{slot.locationCode}</td>
    <td className="px-3 py-2 text-center text-gray-300">{slot.tier}단</td>
    <td className="px-3 py-2 text-center">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        slot.side === 'L' ? 'bg-purple-600/20 text-purple-300' : 'bg-orange-600/20 text-orange-300'
      }`}>{slot.side === 'L' ? '좌' : '우'}</span>
    </td>
  </tr>
))}
```

이렇게 교체 (마지막에 스캔 입력 열 추가):

```jsx
{assignment.map((slot, i) => (
  <tr key={i} className="hover:bg-gray-800/40">
    <td className="px-3 py-2 text-gray-600">{i + 1}</td>
    <td className="px-3 py-2 font-mono text-[#F59E0B]">{palletCodes[i]}</td>
    <td className="px-3 py-2 font-bold text-white">{slot.locationCode}</td>
    <td className="px-3 py-2 text-center text-gray-300">{slot.tier}단</td>
    <td className="px-3 py-2 text-center">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        slot.side === 'L' ? 'bg-purple-600/20 text-purple-300' : 'bg-orange-600/20 text-orange-300'
      }`}>{slot.side === 'L' ? '좌' : '우'}</span>
    </td>
    <td className="px-3 py-2">
      <BarcodeInput
        value={scanValues[i] ?? ''}
        onChange={v => setScanValues(prev => ({ ...prev, [i]: v }))}
        onScan={code => handleSlotScan(i, code)}
        placeholder="슬롯 스캔"
      />
    </td>
  </tr>
))}
```

- [ ] **Step 5: 수동 검증 (webapp-testing 스킬 + node 스크립트로 테스트 데이터 준비)**

먼저 테스트용 입고 오더/파렛트 수 준비가 필요하므로, 실제 웹 화면에서 다음을 순서대로 진행한다:

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

1. `/inbound?tab=register`에서 화주사/상품 1종, 파렛트 수량 2개로 신규 입고 등록
2. `/inbound?tab=instruct`에서 방금 만든 오더의 "지시 →" 클릭, 구역 하나 선택 → 자동 배정된 2줄이 보이는지 확인
3. 자동 배정된 1번째 줄의 로케이션 코드를 확인(예: "B-05", 3단 좌측이라 가정) — 그 슬롯이 아닌 **다른 로케이션의 다른 슬롯 코드**(예: "B-06-2R", 실제 존재하는 로케이션 코드로 바꿔서 사용)를 1번째 줄의 "직접 지정" 입력칸에 입력 후 Enter
4. Expected: 1번째 줄의 "로케이션"/"단"/"좌우" 컬럼이 스캔한 값(B-06, 2단, 우)으로 즉시 바뀜, 오류 없음
5. **중복 검증**: 2번째 줄의 "직접 지정"에 방금 1번째 줄이 된 것과 동일한 코드("B-06-2R")를 입력 → "이미 이번 배치에서 사용 중인 슬롯입니다." 오류가 뜨고 2번째 줄은 바뀌지 않는지 확인
6. **형식 오류 검증**: 아무 줄에 "abc"(형식에 안 맞는 문자열) 입력 → "올바른 슬롯 코드가 아닙니다." 오류 확인
7. **점유 슬롯 검증**: 이미 재고가 있는 슬롯의 코드(예: 기존에 파렛트가 보관 중인 로케이션의 슬롯 — `/locations`나 랙 화면에서 미리 확인)를 입력 → "이미 사용 중인 슬롯입니다." 오류 확인
8. "✅ 지시 완료" 클릭까지 진행해서 실제 `pallets` 테이블에 스캔으로 지정한 슬롯(B-06, 2단, 우)이 정확히 저장됐는지 node 스크립트로 확인:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
db.from('pallets').select('code, location_id, tier, side, status').order('id', { ascending: false }).limit(2)
  .then(({data}) => console.log(JSON.stringify(data, null, 2)));
"
```

Expected: 방금 등록한 2개 파렛트 중 하나가 `tier: 2, side: 'R'`이고 그 `location_id`가 "B-06" 로케이션의 id와 일치하는지 확인 (locations 테이블에서 `SELECT id FROM locations WHERE code = 'B-06'`에 해당하는 값과 비교).

- [ ] **Step 6: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/app/inbound/page.js
git commit -m "feat: 입고지시 단계에 슬롯 바코드 스캔으로 직접 배정하는 기능 추가"
git push origin main
```

---

## Spec Coverage Checklist

| 스펙 요구사항 | 구현 위치 |
| --- | --- |
| 슬롯 단위 바코드 라벨 출력 | Task 1 (`LocationLabelPrinter`) |
| 랙 선택 시 사용 가능한 슬롯 전체 한 번에 출력 | Task 1(`buildSlots`+이전/다음 넘기기), Task 2(버튼 연결) |
| 슬롯 코드 형식 `{code}-{tier}{side}` | Task 1(`slotCode` 생성), Task 3(파싱 정규식) |
| 입고지시 단계에서 스캔으로 특정 슬롯 직접 배정 | Task 3 |
| 스캔한 슬롯이 이미 점유/중복이면 거부 | Task 3(`handleSlotScan`의 순서대로 4~5단계 검증) |
| 스캔한 코드 형식/존재하지 않는 로케이션 오류 안내 | Task 3(`handleSlotScan`의 1~2단계 검증) |
| 자동 배정 로직은 그대로 유지 | Task 3 — `handleZoneChange`/`handleConfirm` 수정 없음, `handleSlotScan`만 추가 |
