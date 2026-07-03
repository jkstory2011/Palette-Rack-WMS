# 5분 무동작 자동 로그아웃 — 설계

## 배경

WMS 페이지 접속 후 5분간 사용자 활동(마우스/키보드 입력)이 없으면 보안을 위해 자동으로 로그아웃시킨다. 현재 저장소에는 이 기능이 전혀 없다 (JWT 자체는 7일 만료지만, 클라이언트 측 idle 타임아웃 로직은 없음).

## 현재 인증 구조 (참고)

- 로그인: `src/app/login/page.js` — 직원 로그인(`POST /api/auth/user-login`, `wms_user` JWT 쿠키) / 개발관리자 로그인(`POST /api/auth`, `wms_auth=1` 플래그 쿠키)
- 라우트 보호: `src/middleware.js` — `wms_auth` 또는 유효한 `wms_user` JWT가 없으면 `/login`으로 리다이렉트
- 로그아웃: `POST /api/auth/logout` — 두 쿠키 모두 `maxAge: 0`으로 삭제
- `src/app/layout.js`는 서버 컴포넌트로, 쿠키를 읽어 `isLoggedIn`을 이미 계산해서 하위 컴포넌트에 내려줄 수 있음

## 요구사항

1. 마지막 활동으로부터 5분(300초) 경과 시 강제 로그아웃
2. 4분(240초) 경과 시점에 "1분 후 자동 로그아웃" 경고 모달 + 60초 카운트다운 표시
3. 경고 모달 노출 중 활동이 감지되면(모달의 "계속 사용하기" 버튼 클릭 포함) 타이머 리셋, 모달 닫힘
4. 여러 탭을 동시에 열어둔 경우, 한 탭의 활동이 모든 탭의 타이머를 리셋
5. 직원 로그인(`wms_user`)과 개발관리자 로그인(`wms_auth`) 모두 동일하게 적용
6. `/login` 페이지 자체에서는 동작하지 않음 (비로그인 상태)

## 아키텍처

새 클라이언트 컴포넌트 `src/components/IdleTimeoutWatcher.js`를 만들어 `src/app/layout.js`에서 `{isLoggedIn && <IdleTimeoutWatcher />}` 형태로 렌더링한다 (기존 `<Navigation>` 조건부 렌더링과 동일한 패턴, `isLoggedIn`은 이미 서버에서 계산되어 있으므로 추가 클라이언트 측 세션 확인 불필요).

### 활동 감지

`window`에 다음 이벤트 리스너를 등록: `mousemove`, `keydown`, `click`, `scroll`, `touchstart`. 이벤트 발생 시마다 `localStorage.setItem('wms_last_activity', Date.now())`를 호출한다 (쓰로틀링: 1초에 최대 1회로 제한해 과도한 쓰기 방지).

### 탭 간 공유

`localStorage`는 브라우저(오리진) 전체에서 공유되므로, 별도의 BroadcastChannel 없이 `wms_last_activity` 값을 공유 소스로 사용한다. 각 탭은 1초 간격 `setInterval`로 `localStorage.getItem('wms_last_activity')`를 읽어 현재 시각과 비교한다 (polling 방식 — `storage` 이벤트는 값을 변경한 탭 자신에게는 발생하지 않으므로, 자기 자신의 상태 갱신에는 polling이 더 단순하고 안전함).

### 타이머 로직 (의사코드)

```js
setInterval(() => {
  const last = Number(localStorage.getItem('wms_last_activity')) || Date.now()
  const idleMs = Date.now() - last

  if (idleMs >= 300_000) {
    logout() // POST /api/auth/logout 후 location.href = '/login'
  } else if (idleMs >= 240_000) {
    showWarningModal(remainingSeconds = Math.ceil((300_000 - idleMs) / 1000))
  } else {
    hideWarningModal()
  }
}, 1000)
```

### 절전/백그라운드 탭 복귀 처리

탭이 백그라운드에 있거나 컴퓨터가 절전 모드였다가 복귀하면 `setInterval`이 지연되거나 멈췄다가 재개될 수 있다. `visibilitychange` 이벤트에서 `document.visibilityState === 'visible'`이 될 때 위와 동일한 `idleMs` 계산을 즉시 1회 실행해, 복귀 즉시 이미 5분이 지났으면 바로 로그아웃 처리한다 (누적 오차로 인해 로그아웃이 지연되는 것을 방지).

### 로그아웃 처리

기존 `Navigation.js`의 `LogoutBtn`과 동일한 로직을 재사용한다:

```js
await fetch('/api/auth/logout', { method: 'POST' })
window.location.href = '/login'
```

(참고: `src/components/LogoutButton.js`는 현재 아무 곳에서도 import되지 않는 죽은 코드다. 이번 작업에서 로그아웃 호출 로직을 별도 유틸 함수로 뽑아 `LogoutBtn`과 `IdleTimeoutWatcher`가 공유하도록 하고, 사용되지 않는 `LogoutButton.js`는 삭제한다.)

### 경고 모달 UI

`IdleTimeoutWatcher` 내부에 인라인으로 간단한 모달을 구현한다 (별도 라이브러리 불필요, 기존 프로젝트에 모달 라이브러리 없음). 문구: "5분간 활동이 없어 곧 로그아웃됩니다 (n초 후)", 버튼: "계속 사용하기".

## 엣지 케이스

| 상황 | 처리 |
| --- | --- |
| 탭이 여러 개 열려있고 하나만 로그아웃 API 호출 | `logout()` 호출은 각 탭에서 개별 실행되지만 `/api/auth/logout`은 멱등(쿠키 삭제)이라 중복 호출돼도 안전. 첫 로그아웃 성공 후 다른 탭도 곧 리다이렉트됨 |
| `localStorage` 접근 불가(프라이빗 모드 등) | try/catch로 감싸고 실패 시 탭별 독립 타이머(메모리 변수)로 폴백 |
| 로그인 직후 `wms_last_activity` 값이 없음 | 컴포넌트 마운트 시 현재 시각으로 즉시 초기화 |
| 사용자가 로그아웃 페이지 이동 중 다시 로그인 | 새 `layout.js` 렌더로 컴포넌트가 새로 마운트되며 타이머 리셋됨 |

## 테스트 계획

- 단위 테스트는 프로젝트에 기존 테스트 프레임워크가 없어(package.json에 test 스크립트 없음) 추가하지 않음 — 대신 수동 시나리오 검증:
  1. 로그인 후 방치 → 4분 시점 경고 모달 노출 확인
  2. 경고 모달에서 "계속 사용하기" 클릭 → 타이머 리셋, 이후 다시 방치 시 정상적으로 4분 후 재경고 확인
  3. 5분 방치 → `/login`으로 리다이렉트, `wms_user`/`wms_auth` 쿠키 삭제 확인
  4. 탭 2개 열고 한쪽에서만 활동 → 다른 탭도 로그아웃 안 됨 확인
  5. 개발관리자 로그인(`wms_auth`)으로도 동일하게 동작 확인
  6. `/login` 페이지에서는 컴포넌트가 렌더링되지 않는지(네트워크 탭에 활동 감지 관련 동작 없음) 확인

## 범위 밖 (Out of scope)

- 서버 측(미들웨어) idle 만료 검증은 하지 않음 (클라이언트 타이머 방식으로 확정)
- 타임아웃 시간(5분/경고 4분)을 관리자 설정으로 노출하는 기능은 이번 범위에 포함하지 않음 — 코드 상수로 하드코딩
