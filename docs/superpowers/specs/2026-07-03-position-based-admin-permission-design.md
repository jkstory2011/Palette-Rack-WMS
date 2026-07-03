# 직급별 관리권한 부여 — 설계

## 배경

현재 관리자 권한(`role = 'admin'`)은 관리자가 직원 개별로 수동으로 지정해야 한다. 직급(예: 팀장, 과장 이상)에 따라 자동으로 관리권한을 부여할 수 있는 방법이 없다. 이 기능은 회사별로 "어떤 직급이 관리자 권한을 갖는지"를 체크박스로 설정할 수 있게 한다.

## 현재 구조 (참고)

- `wms_users` 테이블: `role TEXT DEFAULT 'staff'` (`'staff' | 'admin' | 'superadmin'`, CHECK 제약 없음), `position TEXT DEFAULT '사용자'`, `company_id INTEGER REFERENCES companies(id)`
- 관리자 판정: `src/middleware.js`와 `src/app/layout.js`에서 각각 `isAdmin = devAdmin || role === 'admin' || role === 'superadmin'`를 동일하게 계산 (JWT 검증만으로 판단, DB 조회 없음)
- JWT 페이로드는 로그인 시(`src/app/api/auth/user-login/route.js`) 1회 생성되며 7일 유효 — `role`이 이후 바뀌어도 재로그인 전까지는 반영되지 않음 (기존에도 존재하는 특성)
- 직급 목록이 `src/app/signup/page.js`, `src/app/admin/users/page.js`, `src/app/admin/employees/page.js` 3곳에 각각 하드코딩되어 있음: `사원, 주임, 대리, 팀장, 과장, 차장, 부장, 실장, 대표` (+ 기본값 `사용자`)
- 관리자 UI(`src/app/admin/users/page.js`)에서 이미 직원별 role을 `staff`/`admin`으로 수동 변경 가능 (`PATCH /api/admin/users/[id]`, `ALLOWED = ['role', 'is_active', 'is_approved', 'approved_by', 'approved_at', 'display_name', 'position']`)
- superadmin은 `company_id`가 NULL이며 여러 회사를 전환(`wms_active_company` 쿠키)하며 사용 — 직급 개념과 무관

## 요구사항

1. 회사별로 "어떤 직급이 관리권한을 갖는지"를 체크박스로 설정할 수 있다 (직급 목록 9개 중 다중 선택)
2. 최종 관리자 판정은 `role === 'admin' || role === 'superadmin' || (해당 직원의 직급이 소속 회사에서 관리권한 직급으로 설정됨)` — OR 조건
3. 기존의 "관리자가 직원 개별 role을 직접 admin으로 지정" 기능은 그대로 유지 (직급 기반 설정과 공존)
4. superadmin은 이 기능의 영향을 받지 않음 (기존 role 기반 판정 그대로)
5. 설정 화면은 기존 `src/app/admin/users/page.js`에 섹션으로 추가 (새 페이지 만들지 않음)
6. 직급별 권한 설정이 바뀌어도 이미 로그인된 세션은 재로그인 전까지 반영되지 않음 (기존 role 변경과 동일한 특성 — 새로운 제약 아님, 명시적으로 허용)

## 데이터 모델

새 테이블 (기존 `master.sql`의 FK 컨벤션을 따라 `ON DELETE` 명시 없이 작성):

```sql
CREATE TABLE IF NOT EXISTS wms_position_admin_grants (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  position   TEXT    NOT NULL,
  PRIMARY KEY (company_id, position)
);
```

행이 존재하면 해당 회사의 해당 직급은 관리권한을 가진다. 체크박스 ON → 행 삽입(`upsert`), OFF → 행 삭제. 별도의 `is_admin BOOLEAN` 컬럼을 두지 않고 존재 여부로 표현한다 (불필요한 상태 조합 방지).

### 직급 목록 공용화

현재 `signup/page.js`, `admin/users/page.js`, `admin/employees/page.js` 3곳에 중복 하드코딩된 직급 배열을 `src/lib/positions.js`로 추출한다:

```js
export const POSITIONS = ['사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']
```

이 새 설정 화면이 직급 전체 목록(체크박스 렌더링용)을 필요로 하므로, 이번 작업 범위에서 공용화한다. 기존 3개 파일은 이 상수를 import하도록 수정한다 (각 파일의 기존 사용 방식—맨 앞에 빈 문자열/`'사용자'`을 추가하는 관례 등—은 그대로 유지하고, 배열 내용만 공용 상수를 스프레드해서 사용).

## 권한 판정 반영 위치

### 로그인 시 JWT에 `isPositionAdmin` 클레임 추가

`src/app/api/auth/user-login/route.js`에서 JWT 서명 전에 조회:

```js
const { data: grant } = await db
  .from('wms_position_admin_grants')
  .select('position')
  .eq('company_id', user.company_id)
  .eq('position', user.position)
  .maybeSingle()

const isPositionAdmin = grant !== null
```

`company_id`가 null인 경우(비정상 상태거나 superadmin류) 조회를 건너뛰고 `isPositionAdmin = false`로 처리한다. JWT 페이로드에 `isPositionAdmin` 필드를 추가한다.

### `middleware.js`, `layout.js`의 `isAdmin` 계산 수정

기존:

```js
const isAdmin = devAdmin || userPayload?.role === 'admin' || isSuperAdmin
```

변경:

```js
const isAdmin = devAdmin || userPayload?.role === 'admin' || isSuperAdmin || userPayload?.isPositionAdmin === true
```

두 파일 모두 동일하게 수정한다 (기존에도 두 곳에 동일 로직이 중복되어 있었음 — 이번 기능도 그 패턴을 따른다. 별도 공용 함수로 묶는 리팩터링은 이번 범위 밖).

## 관리 UI/API

### 회사 선택 UI는 새로 만들지 않음 — 기존 전역 스위처 재사용

`src/app/admin/employees/page.js` 등 기존의 회사별 데이터 화면들은 이미 `useCompany()`(`@/context/CompanyContext`)의 `company`를 그대로 사용해 데이터를 스코핑한다 (`Navigation.js`의 `CompanySwitcher`로 superadmin이 전역으로 회사를 전환하면 이 `company`가 바뀜). 이번 기능도 같은 패턴을 따라, 설정 섹션 전용의 새 드롭다운을 만들지 않고 `useCompany()`의 `company.id`를 그대로 사용한다. 일반 admin은 애초에 자기 회사로 고정되어 있고(전환 UI 자체가 안 보임), superadmin만 상단 전역 스위처로 회사를 바꿔가며 이 섹션의 내용을 확인/수정하게 된다.

### API

- `GET /api/admin/position-permissions?companyId={id}` — 주어진 `companyId` 기준으로 `wms_position_admin_grants`를 조회해 관리권한이 설정된 직급 목록(문자열 배열)을 반환.
- `PATCH /api/admin/position-permissions` — body `{ companyId: number, position: string, isAdmin: boolean }`. `isAdmin: true`면 `(company_id, position)` 행을 upsert, `false`면 해당 행을 delete.
- 두 라우트 모두 기존 `/api/admin/*` 패턴과 동일하게 관리자 권한 필요 (미들웨어가 이미 `/api/admin` 전체를 보호함). `companyId`는 프런트에서 `useCompany()`의 `company.id`를 그대로 실어 보낸다 (별도의 서버 측 소속 회사 검증은 기존 `/api/admin/*` 라우트들의 관례를 따름 — 이미 관리자 권한 자체가 미들웨어에서 확인되므로 이번 기능에서 추가 검증 로직을 새로 도입하지 않음).

### UI

`src/app/admin/users/page.js` 상단(직원 목록 테이블 위)에 "직급별 관리권한" 섹션을 추가한다. `useCompany()`로 현재 활성 회사를 가져와, `POSITIONS` 상수를 순회하며 각 직급마다 체크박스를 렌더링하고, 현재 설정 상태는 `GET /api/admin/position-permissions?companyId=...` 결과로 초기화한다. 체크박스 토글 시 즉시 `PATCH`를 호출하고 낙관적으로 UI를 갱신한다 (별도의 "저장" 버튼 없이 토글 즉시 반영 — 기존 `admin/users/page.js`의 `toggleActive()` 등이 이미 이런 즉시-반영 패턴을 쓰고 있으므로 일관성 유지). 직원 목록 테이블 자체는 이번 작업 범위에서 회사별로 필터링하지 않는다 (기존 동작 유지, 이번 기능과 무관한 별도 개선 대상).

## 엣지 케이스

| 상황 | 처리 |
| --- | --- |
| 직급별 권한 설정 변경 후에도 이미 로그인된 사용자의 세션 | 재로그인 전까지 반영 안 됨 (요구사항 6, 기존 role 변경과 동일) |
| superadmin(company_id가 NULL) | 직급별 권한 조회를 건너뛰고 기존 role 기반 판정만 적용 |
| 직원의 직급이 나중에 바뀜(`admin/users/page.js`의 `changePosition()`) | 다음 로그인 시 새 직급 기준으로 `isPositionAdmin` 재계산됨 — 별도 즉시 동기화 로직 불필요 |
| 특정 회사에 해당 직급 직원이 아직 한 명도 없는 상태에서 체크박스를 켬 | 문제 없음 — 그 직급의 직원이 나중에 로그인하면 자동으로 관리권한 적용됨 |
| 회사가 삭제될 때 `wms_position_admin_grants` 잔여 행 | 기존 `company_id` FK들과 동일하게 `ON DELETE` 명시 없음(RESTRICT 기본 동작) — 이번 기능에서 새로운 cascade 정책을 도입하지 않음 |

## 범위 밖 (Out of scope)

- role 변경 시 즉시 세션 갱신(강제 재로그인, 실시간 권한 반영 등)은 다루지 않음 — 기존 동작과 동일하게 유지
- 직급 목록 자체를 관리자가 추가/삭제하는 기능(현재는 코드 상수로 고정된 9개 직급)은 포함하지 않음
- `employees`(HR 마스터 데이터) 테이블과의 연동은 다루지 않음 — 이 기능은 로그인 계정 테이블인 `wms_users` 기준으로만 동작
