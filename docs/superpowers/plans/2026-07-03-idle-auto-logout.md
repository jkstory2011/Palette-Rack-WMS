# 5분 무동작 자동 로그아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 5분간 마우스/키보드 활동이 없으면 자동으로 로그아웃시키고, 4분 시점에 60초 카운트다운 경고 모달을 보여준다.

**Architecture:** 새 클라이언트 컴포넌트 `IdleTimeoutWatcher`가 `src/app/layout.js`에서 로그인 상태일 때만 렌더링된다. 활동 시각은 `localStorage`에 기록해 여러 탭이 공유하고, 1초 간격 폴링으로 경과 시간을 계산해 경고/로그아웃을 트리거한다. 로그아웃은 기존 `POST /api/auth/logout` 엔드포인트를 재사용한다.

**Tech Stack:** Next.js 14 (App Router), React (client component), Tailwind CSS, `localStorage` Web API. 새 npm 패키지 없음.

## Global Constraints

- 경고 표시 시점: 마지막 활동 후 240,000ms(4분) 경과
- 강제 로그아웃 시점: 마지막 활동 후 300,000ms(5분) 경과
- 활동 감지 이벤트: `mousemove`, `keydown`, `click`, `scroll`, `touchstart`
- 활동 기록은 1초(1000ms)에 최대 1회로 쓰로틀링
- 폴링 간격: 1000ms (`setInterval`)
- 직원 로그인(`wms_user`)과 개발관리자 로그인(`wms_auth`) 모두 동일 적용 — `isLoggedIn`이 true일 때 무조건 렌더링하면 자동으로 둘 다 충족됨
- 로그아웃 API는 기존 `POST /api/auth/logout`을 그대로 재사용 (신규 API 만들지 않음)
- 이 프로젝트에는 자동화 테스트 프레임워크가 없음 (package.json에 test 스크립트 없음, jest/vitest 미설치) — 각 태스크의 검증은 `npm run dev` + 브라우저 수동 확인으로 진행한다. 4~5분을 실제로 기다리는 대신, 수동 검증 시에는 `WARNING_AFTER_MS`/`LOGOUT_AFTER_MS` 값을 임시로 낮춰서(예: 5000/10000) 테스트하고, 확인 후 원래 값으로 되돌린다.
- `/login` 페이지에서는 `isLoggedIn`이 항상 false이므로 별도 예외 처리 불필요

---

### Task 1: 로그아웃 로직 공용 유틸로 분리 + 죽은 코드 제거

**Files:**
- Create: `src/lib/logout.js`
- Modify: `src/components/Navigation.js:1-6` (import 추가), `src/components/Navigation.js:369-376` (LogoutBtn 내부 로직)
- Delete: `src/components/LogoutButton.js` (어디에서도 import되지 않는 죽은 코드, `grep -rn "LogoutButton" src/`로 사용처 없음을 재확인 후 삭제)

**Interfaces:**
- Produces: `performLogout(): Promise<void>` — `src/lib/logout.js`에서 export. `POST /api/auth/logout` 호출 후 `window.location.href = '/login'`으로 이동. Task 3의 `IdleTimeoutWatcher`가 이 함수를 그대로 가져다 쓴다.

- [ ] **Step 1: `src/lib/logout.js` 작성**

```js
export async function performLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
```

- [ ] **Step 2: `Navigation.js`에 import 추가**

`src/components/Navigation.js` 5번째 줄(`import { useCompany } from '@/context/CompanyContext'`) 바로 아래에 추가:

```js
import { performLogout } from '@/lib/logout'
```

- [ ] **Step 3: `LogoutBtn`의 `handleLogout`을 공용 유틸로 교체**

`src/components/Navigation.js`의 기존 코드:

```js
function LogoutBtn() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try { await fetch('/api/auth/logout', { method: 'POST' }) }
    finally { window.location.href = '/login' }
  }
```

이렇게 교체:

```js
function LogoutBtn() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await performLogout()
  }
```

(버튼의 나머지 JSX, `disabled={loading}` 등은 그대로 둔다.)

- [ ] **Step 4: 죽은 파일 삭제**

먼저 다른 곳에서 쓰이지 않는지 확인:

```bash
grep -rn "LogoutButton" "D:\Palette Rack WMS\src"
```

Expected: `src/components/LogoutButton.js` 자기 자신의 정의 외에는 아무 결과도 없어야 함(import하는 곳 없음).

확인되면 삭제:

```bash
rm "D:\Palette Rack WMS\src\components\LogoutButton.js"
```

- [ ] **Step 5: 수동 검증 — 기존 로그아웃 버튼이 여전히 동작하는지 확인**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

브라우저에서 `http://localhost:3000/login`으로 로그인 후, 좌측 네비게이션의 로그아웃 아이콘 버튼 클릭.

Expected: `/login` 페이지로 리다이렉트되고, 브라우저 개발자도구 Application 탭에서 `wms_user`/`wms_auth` 쿠키가 삭제되어 있음.

- [ ] **Step 6: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/lib/logout.js src/components/Navigation.js
git rm src/components/LogoutButton.js
git commit -m "refactor: 로그아웃 로직을 src/lib/logout.js로 공용화, 미사용 LogoutButton.js 삭제"
```

---

### Task 2: 활동 시각 추적 유틸 (`idleActivity`)

**Files:**
- Create: `src/lib/idleActivity.js`

**Interfaces:**
- Consumes: 없음 (순수 브라우저 API만 사용: `window.localStorage`, `Date.now()`)
- Produces:
  - `ACTIVITY_STORAGE_KEY: string` (상수, 값 `'wms_last_activity'`)
  - `WARNING_AFTER_MS: number` (상수, 값 `240000`)
  - `LOGOUT_AFTER_MS: number` (상수, 값 `300000`)
  - `recordActivity(): void` — 현재 시각을 활동 시각으로 기록 (1초 쓰로틀)
  - `getIdleMs(): number` — 마지막 활동 이후 경과 시간(ms)을 반환
  - Task 3의 `IdleTimeoutWatcher`가 이 4개를 그대로 import해서 쓴다.

- [ ] **Step 1: `src/lib/idleActivity.js` 작성**

```js
export const ACTIVITY_STORAGE_KEY = 'wms_last_activity'
export const WARNING_AFTER_MS = 240_000 // 4분 경과 시 경고 모달 노출
export const LOGOUT_AFTER_MS = 300_000  // 5분 경과 시 강제 로그아웃

const WRITE_THROTTLE_MS = 1000

let lastWriteAt = 0
let memoryFallbackLastActivity = null

export function recordActivity() {
  const now = Date.now()
  if (now - lastWriteAt < WRITE_THROTTLE_MS) return
  lastWriteAt = now

  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now))
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 탭 메모리로 폴백
    memoryFallbackLastActivity = now
  }
}

export function getIdleMs() {
  let last = null

  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY)
    last = raw ? Number(raw) : null
  } catch {
    last = memoryFallbackLastActivity
  }

  if (!last) {
    recordActivity()
    return 0
  }

  return Date.now() - last
}
```

- [ ] **Step 2: 수동 검증 — 브라우저 콘솔에서 동작 확인**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

브라우저에서 로그인 후 아무 페이지에서 개발자도구 콘솔을 열고 다음을 순서대로 실행:

```js
const m = await import('/src/lib/idleActivity.js')
```

> 참고: Next.js 개발 서버는 이 경로를 직접 서빙하지 않으므로, 이 스텝은 Task 3에서 컴포넌트에 실제로 연결된 뒤 통합 검증으로 대체한다. 이 Step 2는 **문법 오류가 없는지**만 다음 명령으로 확인한다:

```bash
node --check "D:\Palette Rack WMS\src\lib\idleActivity.js"
```

Expected: 아무 출력 없이 종료(exit code 0) — 문법 오류 없음.

- [ ] **Step 3: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/lib/idleActivity.js
git commit -m "feat: 무동작 시간 추적 유틸(idleActivity) 추가"
```

---

### Task 3: `IdleTimeoutWatcher` 컴포넌트 + layout.js 연결

**Files:**
- Create: `src/components/IdleTimeoutWatcher.js`
- Modify: `src/app/layout.js:1-6` (import 추가), `src/app/layout.js:81-83` (조건부 렌더링에 추가)

**Interfaces:**
- Consumes:
  - `recordActivity()`, `getIdleMs()`, `WARNING_AFTER_MS`, `LOGOUT_AFTER_MS` (Task 2, `@/lib/idleActivity`)
  - `performLogout()` (Task 1, `@/lib/logout`)
- Produces: `IdleTimeoutWatcher` — props 없는 default export 클라이언트 컴포넌트. `layout.js`에서 `isLoggedIn`일 때만 렌더링.

- [ ] **Step 1: `src/components/IdleTimeoutWatcher.js` 작성**

```jsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { recordActivity, getIdleMs, WARNING_AFTER_MS, LOGOUT_AFTER_MS } from '@/lib/idleActivity'
import { performLogout } from '@/lib/logout'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
const POLL_INTERVAL_MS = 1000

export default function IdleTimeoutWatcher() {
  const [secondsLeft, setSecondsLeft] = useState(null) // null = 경고 모달 숨김
  const loggedOutRef = useRef(false)

  useEffect(() => {
    recordActivity() // 마운트 시 활동 시각 초기화

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, recordActivity))

    function check() {
      if (loggedOutRef.current) return
      const idleMs = getIdleMs()

      if (idleMs >= LOGOUT_AFTER_MS) {
        loggedOutRef.current = true
        performLogout()
        return
      }

      if (idleMs >= WARNING_AFTER_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((LOGOUT_AFTER_MS - idleMs) / 1000)))
      } else {
        setSecondsLeft(null)
      }
    }

    const intervalId = setInterval(check, POLL_INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, recordActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(intervalId)
    }
  }, [])

  function handleContinue() {
    recordActivity()
    setSecondsLeft(null)
  }

  if (secondsLeft === null) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="rounded-xl p-6 max-w-sm w-full text-center"
          style={{ background: '#151822', border: '1px solid #2A2F3A' }}
        >
          <p className="text-white font-semibold text-lg mb-2">
            자동 로그아웃 안내
          </p>
          <p className="text-gray-400 text-sm mb-5">
            5분간 활동이 없어 <span className="text-amber-400 font-semibold">{secondsLeft}초</span> 후 자동 로그아웃됩니다.
          </p>
          <button
            onClick={handleContinue}
            className="w-full px-5 py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            계속 사용하기
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: `layout.js`에 import 추가**

`src/app/layout.js` 4번째 줄(`import Navigation from '@/components/Navigation'`) 바로 아래에 추가:

```js
import IdleTimeoutWatcher from '@/components/IdleTimeoutWatcher'
```

- [ ] **Step 3: `layout.js`의 조건부 렌더링에 추가**

기존 코드 (81~83번째 줄):

```js
          {isLoggedIn && (
            <Navigation isAdmin={isAdmin} displayName={displayName} position={position} />
          )}
```

이렇게 교체:

```js
          {isLoggedIn && (
            <>
              <Navigation isAdmin={isAdmin} displayName={displayName} position={position} />
              <IdleTimeoutWatcher />
            </>
          )}
```

- [ ] **Step 4: 임시로 타임아웃 값을 낮춰서 빠르게 검증 준비**

`src/lib/idleActivity.js`의 두 상수를 잠깐 바꾼다 (검증 후 반드시 원복):

```js
export const WARNING_AFTER_MS = 5_000   // 임시: 5초
export const LOGOUT_AFTER_MS = 10_000   // 임시: 10초
```

- [ ] **Step 5: 수동 검증 — 경고 모달 & 자동 로그아웃 전체 흐름**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

브라우저에서 `http://localhost:3000/login`으로 로그인 후 아무 것도 하지 않고 기다린다.

Expected:
1. 5초 경과 시 화면 중앙에 "자동 로그아웃 안내" 모달과 카운트다운(10, 9, 8...) 표시
2. 모달이 떠 있는 동안 "계속 사용하기" 버튼 클릭 → 모달 사라짐, 다시 5초 후 재노출됨(타이머 리셋 확인)
3. 아무 조작 없이 10초 총 경과 → `/login`으로 자동 리다이렉트, 개발자도구 Application 탭에서 `wms_user`/`wms_auth` 쿠키 삭제 확인

- [ ] **Step 6: 수동 검증 — 다중 탭 동기화**

같은 브라우저에서 로그인된 상태로 탭을 하나 더 연다 (`http://localhost:3000` 새 탭). 탭 A에서는 계속 마우스를 움직이고, 탭 B는 그대로 둔다.

Expected: 탭 A의 활동으로 인해 탭 B에서도 경고 모달이 뜨지 않고 로그아웃되지 않음 (localStorage 공유 확인).

- [ ] **Step 7: 수동 검증 — 개발관리자 로그인 계정에도 적용되는지 확인**

`/login` 페이지의 "🔧 개발관리자" 탭으로 로그인 후 동일하게 5초/10초 흐름이 동작하는지 확인.

- [ ] **Step 8: 타임아웃 값 원복**

`src/lib/idleActivity.js`를 원래 값으로 되돌린다:

```js
export const WARNING_AFTER_MS = 240_000 // 4분 경과 시 경고 모달 노출
export const LOGOUT_AFTER_MS = 300_000  // 5분 경과 시 강제 로그아웃
```

- [ ] **Step 9: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/components/IdleTimeoutWatcher.js src/app/layout.js src/lib/idleActivity.js
git commit -m "feat: 5분 무동작 자동 로그아웃 기능 추가 (IdleTimeoutWatcher)"
git push origin main
```

---

## Spec Coverage Checklist

| 스펙 요구사항 | 구현 위치 |
| --- | --- |
| 5분 경과 시 강제 로그아웃 | Task 3, `IdleTimeoutWatcher`의 `check()` 내 `LOGOUT_AFTER_MS` 분기 |
| 4분 경과 시 경고 모달 + 60초 카운트다운 | Task 3, `check()`의 `WARNING_AFTER_MS` 분기 + `secondsLeft` 렌더링 |
| 경고 중 활동 시 리셋 | Task 3, `handleContinue()` 및 activity 이벤트 리스너가 계속 `recordActivity()` 호출 |
| 다중 탭 동기화 | Task 2, `localStorage` 기반 `idleActivity` 모듈 |
| 직원/개발관리자 로그인 모두 적용 | Task 3, `layout.js`의 `isLoggedIn` 조건 (devAdmin 여부와 무관) |
| `/login`에서 미동작 | `isLoggedIn`이 로그인 페이지에서 항상 false — 별도 처리 불필요 |
| 절전/백그라운드 복귀 시 즉시 재계산 | Task 3, `visibilitychange` 리스너의 `handleVisibility` |
| 로그아웃 로직 재사용 + 죽은 코드 정리 | Task 1 |
