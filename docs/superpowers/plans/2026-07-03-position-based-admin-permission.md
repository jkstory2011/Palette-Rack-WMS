# 직급별 관리권한 부여 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회사별로 "어떤 직급이 관리자 권한을 갖는지" 체크박스로 설정할 수 있게 하고, 해당 직급의 직원은 로그인 시 자동으로 관리자 권한을 갖는다.

**Architecture:** 새 테이블 `wms_position_admin_grants(company_id, position)`에 행 존재 여부로 권한을 표현한다. 로그인 시 이 테이블을 조회해 JWT에 `isPositionAdmin` 클레임을 심고, `middleware.js`/`layout.js`의 기존 `isAdmin` 계산식에 OR 조건으로 추가한다. 설정 UI는 기존 `admin/users` 페이지에 섹션으로 추가하고, 기존 전역 회사 전환 컨텍스트(`useCompany()`)를 재사용한다.

**Tech Stack:** Next.js 14 App Router, Supabase(PostgreSQL + `@supabase/supabase-js`), `jose`(JWT). 새 npm 패키지 없음.

## Global Constraints

- 최종 관리자 판정: `role === 'admin' || role === 'superadmin' || isPositionAdmin === true` (OR 조건, 기존 role 기반 수동 지정 기능은 그대로 유지)
- 직급별 권한 설정은 **회사별 개별 설정** (`wms_position_admin_grants.company_id`로 구분)
- superadmin(`company_id`가 NULL)은 이 기능의 영향을 받지 않음 — 항상 기존 role 기반으로만 판정
- 직급 목록(공용 상수, 순서 고정): `사원, 주임, 대리, 팀장, 과장, 차장, 부장, 실장, 대표`
- 설정 UI는 새 페이지를 만들지 않고 기존 `src/app/admin/users/page.js`에 섹션으로 추가
- 회사 선택 UI는 새로 만들지 않고 기존 `useCompany()`(`@/context/CompanyContext`)의 전역 회사 컨텍스트를 그대로 사용
- 직급별 권한 설정이 바뀌어도 이미 로그인된 세션은 재로그인 전까지 반영되지 않음 (기존 role 변경과 동일한 특성, 새로운 제약 아님)
- **이 프로젝트는 DB 스키마 변경(DDL)을 자동 실행할 수단이 없다** — `supabase/migrations/` 폴더와 `scripts/migrate.js`의 자동 마이그레이션 파이프라인은 현재 이 저장소에서 실제로 쓰이고 있지 않다(마이그레이션 폴더 자체가 없음). 실제로는 `supabase/master.sql`을 사람이 Supabase SQL Editor에 직접 붙여넣어 실행하는 방식으로 스키마를 관리한다. 새 테이블(`CREATE TABLE`)이 필요한 Task 2는 사람이 SQL을 실행해줘야 하며, 그 이후의 데이터 조작(행 삽입/조회/삭제)은 `@supabase/supabase-js`로 정상적으로 가능하다 (DDL이 아니라 DML이므로).
- 이 프로젝트에는 자동화 테스트 프레임워크가 없음 — 검증은 `node --env-file=.env.local -e "..."` 스크립트, `curl`, 그리고 webapp-testing(Playwright) 스킬을 통한 실제 브라우저 조작으로 진행한다

---

### Task 1: 직급 목록 공용 상수 생성 + 3개 파일 교체

**Files:**
- Create: `src/lib/positions.js`
- Modify: `src/app/admin/users/page.js:1-6`
- Modify: `src/app/admin/employees/page.js:1-13`
- Modify: `src/app/signup/page.js` (import 추가 + 88-104번째 줄의 `<select>` 내부를 `.map()`으로 교체)

**Interfaces:**
- Produces: `POSITIONS: string[]` — `src/lib/positions.js`에서 export. 정확한 값: `['사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']`. Task 6이 이 상수를 그대로 가져다 쓴다.

- [ ] **Step 1: `src/lib/positions.js` 작성**

```js
export const POSITIONS = ['사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']
```

- [ ] **Step 2: `admin/users/page.js` 수정**

기존 (1~6번째 줄):

```js
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const POSITIONS = ['사용자', '사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']
```

이렇게 교체:

```js
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { POSITIONS as BASE_POSITIONS } from '@/lib/positions'

const POSITIONS = ['사용자', ...BASE_POSITIONS]
```

- [ ] **Step 3: `admin/employees/page.js` 수정**

기존 (1~13번째 줄):

```js
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/context/CompanyContext'

const EMPTY = {
  emp_code: '', name: '', department: '', position: '',
  phone: '', email: '', hire_date: '', note: '',
}

const DEPARTMENTS = ['', '관리', '입고팀', '출고팀', '생산팀', '물류팀', '영업팀', '기타']
const POSITIONS   = ['', '사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']
```

이렇게 교체:

```js
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/context/CompanyContext'
import { POSITIONS as BASE_POSITIONS } from '@/lib/positions'

const EMPTY = {
  emp_code: '', name: '', department: '', position: '',
  phone: '', email: '', hire_date: '', note: '',
}

const DEPARTMENTS = ['', '관리', '입고팀', '출고팀', '생산팀', '물류팀', '영업팀', '기타']
const POSITIONS   = ['', ...BASE_POSITIONS]
```

- [ ] **Step 4: `signup/page.js` 수정**

먼저 파일 상단의 import 구문을 확인하고 (`Read src/app/signup/page.js`의 1~10번째 줄), 다른 import들 바로 아래에 추가:

```js
import { POSITIONS } from '@/lib/positions'
```

그 다음, 기존 (88~104번째 줄):

```js
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">직급</label>
            <select value={form.position} onChange={f('position')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">선택 안 함 (사용자)</option>
              <option value="사원">사원</option>
              <option value="주임">주임</option>
              <option value="대리">대리</option>
              <option value="팀장">팀장</option>
              <option value="과장">과장</option>
              <option value="차장">차장</option>
              <option value="부장">부장</option>
              <option value="실장">실장</option>
              <option value="대표">대표</option>
            </select>
          </div>
```

이렇게 교체:

```js
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">직급</label>
            <select value={form.position} onChange={f('position')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">선택 안 함 (사용자)</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
```

- [ ] **Step 5: 수동 검증 — 3개 페이지가 여전히 정상 렌더링되는지 확인**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

브라우저에서 다음을 확인:
1. `http://localhost:3000/signup` — 직급 드롭다운에 기존과 동일하게 "선택 안 함 (사용자)" + 9개 직급이 나오는지
2. 개발관리자로 로그인 후 `http://localhost:3000/admin/users` — "전체 직원" 탭의 직급 드롭다운에 "사용자" + 9개 직급이 나오는지
3. `http://localhost:3000/admin/employees` — 직급 드롭다운에 빈 값("선택") + 9개 직급이 나오는지

세 곳 모두 이전과 동일한 목록/순서로 보이면 통과.

- [ ] **Step 6: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/lib/positions.js src/app/admin/users/page.js src/app/admin/employees/page.js src/app/signup/page.js
git commit -m "refactor: 직급 목록을 src/lib/positions.js로 공용화"
```

---

### Task 2: DB 테이블 추가 (`wms_position_admin_grants`)

**Files:**
- Modify: `supabase/master.sql` (파일 끝에 새 섹션 추가)

**Interfaces:**
- Produces: 테이블 `wms_position_admin_grants(company_id INTEGER, position TEXT)`, PK `(company_id, position)`. Task 3, 5가 이 테이블을 읽고 쓴다.

- [ ] **Step 1: `supabase/master.sql` 파일 끝에 추가**

파일은 현재 다음으로 끝난다 (418번째 줄, superadmin 계정 INSERT):

```sql
-- superadmin 계정 (비밀번호: palette@super2024)
INSERT INTO wms_users (username, display_name, password_hash, role, is_approved, is_active, company_id)
VALUES (
  'superadmin', '시스템 관리자',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lB0W',
  'superadmin', true, true, NULL
)
ON CONFLICT (username) DO NOTHING;
```

그 뒤에 다음을 새로 추가한다:

```sql

-- ──────────────────────────────────────────
-- 19. 직급별 관리권한 (회사별 설정)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_position_admin_grants (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  position   TEXT    NOT NULL,
  PRIMARY KEY (company_id, position)
);
ALTER TABLE wms_position_admin_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON wms_position_admin_grants;
CREATE POLICY "allow_all" ON wms_position_admin_grants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

(기존 `companies`, `wms_users` 등 다른 테이블과 동일한 `IF NOT EXISTS` + RLS `allow_all` 컨벤션을 그대로 따른 것 — 이 프로젝트는 실질적인 접근 제어를 앱/API 레이어에서 처리하고 RLS는 형식적으로만 켜져 있다.)

- [ ] **Step 2: 사람에게 수동 실행 요청 — 이 스텝은 구현자가 직접 할 수 없음**

이 프로젝트는 DDL을 자동 실행할 수단이 없다(Global Constraints 참고). 구현자는 이 Step에서 **BLOCKED가 아니라 DONE_WITH_CONCERNS로 보고**하고, 보고서에 다음을 명시한다:

> "`supabase/master.sql`에 추가한 아래 SQL을 Supabase 프로젝트의 SQL Editor에서 직접 실행해야 합니다. 실행 전에는 Task 3 이후의 실제 로그인/DB 연동 테스트가 불가능합니다."
>
> (추가한 SQL 전문을 보고서에 다시 인용)

컨트롤러(사용자를 상대하는 주체)는 이 보고를 받으면, Task 3을 디스패치하기 전에 사용자에게 실제로 이 SQL을 Supabase SQL Editor에서 실행했는지 확인받아야 한다.

- [ ] **Step 3: 문법 검증 (사람의 실행 전에 할 수 있는 유일한 자동 검증)**

SQL 문법 자체가 기존 파일의 다른 `CREATE TABLE IF NOT EXISTS ... REFERENCES companies(id)` 패턴과 정확히 같은 구조인지 눈으로 대조 확인한다 (예: `companies` 테이블 정의가 `supabase/master.sql`의 377번째 줄 근처에 실제로 존재하는지, 참조 무결성이 깨지지 않는지).

```bash
grep -n "CREATE TABLE IF NOT EXISTS companies" "D:\Palette Rack WMS\supabase\master.sql"
```

Expected: 1줄 출력 (companies 테이블 정의가 실제로 존재함을 확인).

- [ ] **Step 4: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add supabase/master.sql
git commit -m "feat(db): wms_position_admin_grants 테이블 추가 (직급별 관리권한, 회사별 설정)"
```

---

### Task 3: 로그인 시 JWT에 `isPositionAdmin` 클레임 추가

**선행 조건:** Task 2의 SQL이 실제 Supabase 프로젝트에 적용되어 있어야 이 태스크의 실제 동작 검증(Step 4)이 가능하다. 적용 전이면 구현자는 코드 작성까지만 하고 NEEDS_CONTEXT로 보고한다.

**Files:**
- Modify: `src/app/api/auth/user-login/route.js`

**Interfaces:**
- Consumes: 테이블 `wms_position_admin_grants` (Task 2)
- Produces: JWT 페이로드에 `isPositionAdmin: boolean` 필드 추가. Task 4가 `middleware.js`/`layout.js`에서 `userPayload?.isPositionAdmin`으로 이 필드를 읽는다.

- [ ] **Step 1: `user-login/route.js` 수정**

기존 (39~55번째 줄):

```js
  // 회사 정보 조회
  let company = null
  if (user.company_id) {
    const { data: co } = await db.from('companies').select('id, code, name').eq('id', user.company_id).single()
    company = co ?? null
  }

  const token = await signToken({
    sub:         user.id,
    username:    user.username,
    displayName: user.display_name,
    role:        user.role,
    position:    user.position ?? '사용자',
    companyId:   user.company_id ?? null,
    companyCode: company?.code ?? null,
    companyName: company?.name ?? null,
  })
```

이렇게 교체:

```js
  // 회사 정보 조회
  let company = null
  if (user.company_id) {
    const { data: co } = await db.from('companies').select('id, code, name').eq('id', user.company_id).single()
    company = co ?? null
  }

  // 직급 기반 관리권한 조회 (회사별 설정)
  let isPositionAdmin = false
  if (user.company_id) {
    const { data: grant } = await db
      .from('wms_position_admin_grants')
      .select('position')
      .eq('company_id', user.company_id)
      .eq('position', user.position)
      .maybeSingle()
    isPositionAdmin = grant !== null
  }

  const token = await signToken({
    sub:         user.id,
    username:    user.username,
    displayName: user.display_name,
    role:        user.role,
    position:    user.position ?? '사용자',
    companyId:   user.company_id ?? null,
    companyCode: company?.code ?? null,
    companyName: company?.name ?? null,
    isPositionAdmin,
  })
```

- [ ] **Step 2: 테스트용 데이터 준비 스크립트 작성**

`D:\Palette Rack WMS\.superpowers\sdd\task3-setup.js` 파일을 만든다 (이 파일은 검증 후 삭제할 임시 스크립트이며 커밋하지 않는다):

```js
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const passwordHash = await bcrypt.hash('Test1234!', 10)

  await db.from('wms_users').delete().eq('username', 'positiontest1')
  const { error: insertErr } = await db.from('wms_users').insert({
    username: 'positiontest1',
    display_name: '직급테스트',
    password_hash: passwordHash,
    role: 'staff',
    position: '팀장',
    company_id: 1,
    is_approved: true,
    is_active: true,
  })
  if (insertErr) { console.error('insert 실패:', insertErr.message); process.exit(1) }

  await db.from('wms_position_admin_grants').delete().eq('company_id', 1).eq('position', '팀장')
  const { error: grantErr } = await db.from('wms_position_admin_grants').insert({ company_id: 1, position: '팀장' })
  if (grantErr) { console.error('grant insert 실패:', grantErr.message); process.exit(1) }

  console.log('테스트 데이터 준비 완료: positiontest1 / Test1234! (회사 1, 팀장, 팀장=관리권한 부여됨)')
}

main()
```

실행:

```bash
cd "D:\Palette Rack WMS"
node --env-file=.env.local .superpowers/sdd/task3-setup.js
```

Expected: `테스트 데이터 준비 완료: ...` 출력. `insert 실패`나 `grant insert 실패`가 뜨면, Task 2의 SQL이 아직 Supabase에 적용되지 않았을 가능성이 높다 — 이 경우 NEEDS_CONTEXT로 보고하고 컨트롤러에게 확인을 요청한다.

- [ ] **Step 3: 로그인 후 JWT 페이로드 확인**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

서버가 뜬 후:

```bash
RESPONSE=$(curl -s -i -X POST http://localhost:3000/api/auth/user-login \
  -H "Content-Type: application/json" \
  -d '{"username":"positiontest1","password":"Test1234!"}')
TOKEN=$(echo "$RESPONSE" | grep -o 'wms_user=[^;]*' | head -1 | cut -d= -f2)
node -e "console.log(JSON.stringify(JSON.parse(Buffer.from(process.argv[1].split('.')[1], 'base64url').toString()), null, 2))" "$TOKEN"
```

Expected: JSON 출력에 `"isPositionAdmin": true`가 포함됨 (팀장 직급이 회사 1에서 관리권한으로 설정되어 있으므로).

추가로, 관리권한이 없는 직급으로도 확인 (같은 스크립트에서 `position: '사원'`으로 바꾸고 grant는 만들지 않은 별도 테스트 계정, 또는 grant를 지우고 재로그인) — 최소한 `false`가 나오는 경우도 한 번은 확인한다:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
db.from('wms_position_admin_grants').delete().eq('company_id', 1).eq('position', '팀장').then(() => console.log('grant 삭제 완료'));
"
```

그 다음 위의 curl+decode를 다시 실행해서 `"isPositionAdmin": false`가 나오는지 확인한다.

- [ ] **Step 4: 테스트 데이터 정리**

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
Promise.all([
  db.from('wms_users').delete().eq('username', 'positiontest1'),
  db.from('wms_position_admin_grants').delete().eq('company_id', 1).eq('position', '팀장'),
]).then(() => console.log('정리 완료'));
"
rm "D:\Palette Rack WMS\.superpowers\sdd\task3-setup.js"
```

- [ ] **Step 5: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/app/api/auth/user-login/route.js
git commit -m "feat: 로그인 시 직급 기반 관리권한(isPositionAdmin)을 JWT에 포함"
```

---

### Task 4: `middleware.js` / `layout.js`의 `isAdmin` 판정에 반영

**Files:**
- Modify: `src/middleware.js:18-20`
- Modify: `src/app/layout.js:22-24`

**Interfaces:**
- Consumes: JWT의 `isPositionAdmin` 필드 (Task 3)

- [ ] **Step 1: `src/middleware.js` 수정**

기존 (18~20번째 줄):

```js
  const isAuthed      = devAdmin || user !== null
  const isSuperAdmin  = user?.role === 'superadmin'
  const isAdmin       = devAdmin || user?.role === 'admin' || isSuperAdmin
```

이렇게 교체:

```js
  const isAuthed      = devAdmin || user !== null
  const isSuperAdmin  = user?.role === 'superadmin'
  const isAdmin       = devAdmin || user?.role === 'admin' || isSuperAdmin || user?.isPositionAdmin === true
```

- [ ] **Step 2: `src/app/layout.js` 수정**

기존 (22~24번째 줄):

```js
  const isLoggedIn   = devAdmin || userPayload !== null
  const isSuperAdmin = userPayload?.role === 'superadmin'
  const isAdmin      = devAdmin || userPayload?.role === 'admin' || isSuperAdmin
```

이렇게 교체:

```js
  const isLoggedIn   = devAdmin || userPayload !== null
  const isSuperAdmin = userPayload?.role === 'superadmin'
  const isAdmin      = devAdmin || userPayload?.role === 'admin' || isSuperAdmin || userPayload?.isPositionAdmin === true
```

- [ ] **Step 3: 테스트 데이터 재준비 (Task 3의 스크립트 재사용)**

Task 3의 Step 2 스크립트를 다시 임시로 만들어 실행한다 (이번엔 `/admin` 경로 접근까지 확인하기 위함):

```bash
cat > "D:\Palette Rack WMS\.superpowers\sdd\task4-setup.js" << 'EOF'
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const passwordHash = await bcrypt.hash('Test1234!', 10)

  await db.from('wms_users').delete().eq('username', 'positiontest2')
  await db.from('wms_users').insert({
    username: 'positiontest2', display_name: '직급테스트2', password_hash: passwordHash,
    role: 'staff', position: '팀장', company_id: 1, is_approved: true, is_active: true,
  })
  await db.from('wms_position_admin_grants').delete().eq('company_id', 1).eq('position', '팀장')
  await db.from('wms_position_admin_grants').insert({ company_id: 1, position: '팀장' })

  console.log('준비 완료')
}
main()
EOF
node --env-file=.env.local "D:\Palette Rack WMS\.superpowers\sdd\task4-setup.js"
```

- [ ] **Step 4: `/admin` 접근 확인**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

```bash
curl -s -i -X POST http://localhost:3000/api/auth/user-login \
  -H "Content-Type: application/json" \
  -d '{"username":"positiontest2","password":"Test1234!"}' \
  -c "D:\Palette Rack WMS\.superpowers\sdd\task4-cookies.txt" > /dev/null

curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  -b "D:\Palette Rack WMS\.superpowers\sdd\task4-cookies.txt" \
  http://localhost:3000/api/admin/users
```

Expected: `HTTP Status: 200` (팀장이 관리권한 직급으로 설정되어 있으므로 `/api/admin/users`에 접근 가능해야 함). role은 여전히 `'staff'`인 채로 접근되는 것이 이 기능의 핵심 — role 기반이었다면 403/redirect가 났을 것.

관리권한 직급 설정을 지우고(위 정리 스크립트 패턴 참고, `wms_position_admin_grants`에서 해당 행 삭제) 같은 계정으로 재로그인 후 다시 `/api/admin/users`를 호출하면 리다이렉트(로그인 페이지로 302/307) 또는 401/403이 나오는지도 확인한다.

- [ ] **Step 5: 테스트 데이터 및 임시 파일 정리**

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
Promise.all([
  db.from('wms_users').delete().eq('username', 'positiontest2'),
  db.from('wms_position_admin_grants').delete().eq('company_id', 1).eq('position', '팀장'),
]).then(() => console.log('정리 완료'));
"
rm "D:\Palette Rack WMS\.superpowers\sdd\task4-setup.js" "D:\Palette Rack WMS\.superpowers\sdd\task4-cookies.txt"
```

- [ ] **Step 6: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/middleware.js src/app/layout.js
git commit -m "feat: isAdmin 판정에 직급 기반 관리권한(isPositionAdmin) 반영"
```

---

### Task 5: 직급별 관리권한 설정 API (`GET`/`PATCH /api/admin/position-permissions`)

**Files:**
- Create: `src/app/api/admin/position-permissions/route.js`

**Interfaces:**
- Consumes: 테이블 `wms_position_admin_grants` (Task 2)
- Produces:
  - `GET /api/admin/position-permissions?companyId={id}` → `string[]` (JSON 배열, 관리권한이 설정된 직급 이름들)
  - `PATCH /api/admin/position-permissions` body `{ companyId: number, position: string, isAdmin: boolean }` → `{ ok: true }`
  - Task 6이 이 두 엔드포인트를 그대로 호출한다.

- [ ] **Step 1: `src/app/api/admin/position-permissions/route.js` 작성**

```js
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId가 필요합니다.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('wms_position_admin_grants')
    .select('position')
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(r => r.position))
}

export async function PATCH(req) {
  const { companyId, position, isAdmin } = await req.json()

  if (!companyId || !position) {
    return NextResponse.json({ error: 'companyId와 position이 필요합니다.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  if (isAdmin) {
    const { error } = await db
      .from('wms_position_admin_grants')
      .upsert({ company_id: companyId, position })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db
      .from('wms_position_admin_grants')
      .delete()
      .eq('company_id', companyId)
      .eq('position', position)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

(`/api/admin/*`는 `src/middleware.js`의 `ADMIN_PATHS`에 이미 포함되어 있어 관리자 권한 없이는 접근 자체가 막힌다 — 이 라우트 안에서 별도로 권한을 재확인할 필요 없음, 기존 `/api/admin/users` 라우트들과 동일한 패턴.)

- [ ] **Step 2: 수동 검증 (개발관리자 계정 사용 — role 무관하게 항상 admin이므로 가장 간단)**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

`.env.local`의 `SITE_PASSWORD` 값을 확인한 뒤:

```bash
curl -s -i -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"<SITE_PASSWORD 값>"}' \
  -c "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" > /dev/null

# 1) 초기 상태: 빈 배열
curl -s -b "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" \
  "http://localhost:3000/api/admin/position-permissions?companyId=1"
```

Expected: `[]`

```bash
# 2) 팀장 체크 ON
curl -s -X PATCH http://localhost:3000/api/admin/position-permissions \
  -H "Content-Type: application/json" \
  -b "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" \
  -d '{"companyId":1,"position":"팀장","isAdmin":true}'
```

Expected: `{"ok":true}`

```bash
# 3) 다시 조회
curl -s -b "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" \
  "http://localhost:3000/api/admin/position-permissions?companyId=1"
```

Expected: `["팀장"]`

```bash
# 4) 팀장 체크 OFF
curl -s -X PATCH http://localhost:3000/api/admin/position-permissions \
  -H "Content-Type: application/json" \
  -b "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" \
  -d '{"companyId":1,"position":"팀장","isAdmin":false}'

curl -s -b "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt" \
  "http://localhost:3000/api/admin/position-permissions?companyId=1"
```

Expected: 마지막 조회 결과가 다시 `[]`

- [ ] **Step 3: 임시 파일 정리**

```bash
rm "D:\Palette Rack WMS\.superpowers\sdd\task5-cookies.txt"
```

- [ ] **Step 4: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/app/api/admin/position-permissions/route.js
git commit -m "feat: 직급별 관리권한 설정 API 추가 (GET/PATCH /api/admin/position-permissions)"
```

---

### Task 6: `admin/users` 페이지에 직급별 관리권한 체크박스 섹션 추가

**Files:**
- Modify: `src/app/admin/users/page.js`

**Interfaces:**
- Consumes:
  - `POSITIONS`/`BASE_POSITIONS` (Task 1, `@/lib/positions`) — Task 1에서 이 파일에는 이미 `import { POSITIONS as BASE_POSITIONS } from '@/lib/positions'`가 추가되어 있음
  - `GET`/`PATCH /api/admin/position-permissions` (Task 5)
  - `useCompany()` (`@/context/CompanyContext`, 기존 코드, 이번에 새로 import)

- [ ] **Step 1: `useCompany` import 추가**

`src/app/admin/users/page.js` 상단의 import 구문(Task 1에서 이미 `POSITIONS` import가 추가된 상태) 바로 아래에 추가:

```js
import { useCompany } from '@/context/CompanyContext'
```

- [ ] **Step 2: `PositionPermissionSettings` 컴포넌트 작성**

`src/app/admin/users/page.js`의 `PositionSelect` 함수 정의(기존 8~18번째 줄) 바로 아래에 새 함수를 추가:

```js
function PositionPermissionSettings() {
  const { company } = useCompany() ?? {}
  const [adminPositions, setAdminPositions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company?.id) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/admin/position-permissions?companyId=${company.id}`)
      .then(res => res.json())
      .then(data => setAdminPositions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [company?.id])

  async function toggle(position, checked) {
    setAdminPositions(prev => checked ? [...prev, position] : prev.filter(p => p !== position))
    try {
      const res = await fetch('/api/admin/position-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, position, isAdmin: checked }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setAdminPositions(prev => checked ? prev.filter(p => p !== position) : [...prev, position])
    }
  }

  if (!company?.id) return null

  return (
    <div className="wms-card space-y-3">
      <h2 className="text-sm font-bold text-white">직급별 관리권한 ({company.name})</h2>
      {loading ? (
        <p className="text-xs text-gray-500">불러오는 중...</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {BASE_POSITIONS.map(pos => (
            <label key={pos} className="flex items-center gap-1.5 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={adminPositions.includes(pos)}
                onChange={e => toggle(pos, e.target.checked)}
              />
              {pos}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `UsersPage`의 렌더링에 섹션 추가**

기존 (176~184번째 줄, 헤더 부분):

```js
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/admin"
          className="text-slate-500 hover:text-slate-300 transition-colors text-sm flex items-center gap-1">
          ← 관리 홈
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-2xl font-black text-white tracking-tight">👥 회원 관리</h1>
      </div>
```

이 블록 바로 다음 줄(186번째 줄, "현황 카드" 주석 위)에 추가:

```js
      <PositionPermissionSettings />
```

- [ ] **Step 4: 수동 검증 (webapp-testing 스킬로 실제 브라우저 조작)**

```bash
cd "D:\Palette Rack WMS"
npm run dev
```

webapp-testing 스킬(Playwright)로 다음을 확인한다:
1. `/login`의 "🔧 개발관리자" 탭으로 로그인 (`.env.local`의 `SITE_PASSWORD` 사용) 후 `/admin/users`로 이동
2. "직급별 관리권한 (...)" 섹션이 보이고, 회사 이름이 표시되는지 확인
3. "팀장" 체크박스를 클릭 → 체크된 상태로 바뀌는지 확인
4. 페이지를 새로고침(reload) → 방금 체크한 "팀장"이 여전히 체크된 상태로 남아있는지 확인 (서버에 실제로 저장됐다는 뜻)
5. "팀장" 체크박스를 다시 클릭해서 해제 → 새로고침 후에도 해제된 상태로 유지되는지 확인 (정리 겸 검증)

- [ ] **Step 5: 커밋**

```bash
cd "D:\Palette Rack WMS"
git add src/app/admin/users/page.js
git commit -m "feat: admin/users 페이지에 직급별 관리권한 설정 섹션 추가"
git push origin main
```

---

## Spec Coverage Checklist

| 스펙 요구사항 | 구현 위치 |
| --- | --- |
| 회사별로 직급별 관리권한 체크박스 설정 | Task 2(테이블), Task 5(API), Task 6(UI) |
| `role === 'admin' \|\| 'superadmin' \|\| isPositionAdmin` OR 판정 | Task 3(JWT 클레임 생성), Task 4(middleware/layout 반영) |
| 기존 개별 role 수동 지정 기능 유지 | Task 4에서 OR로 추가만 함, 기존 role 체크 로직 삭제 안 함 |
| superadmin은 영향 없음 | Task 3에서 `user.company_id`가 없으면(superadmin) 조회 자체를 건너뛰어 `isPositionAdmin=false` 고정 |
| 설정 화면은 기존 admin/users 페이지에 추가 | Task 6 |
| 회사 선택은 기존 전역 스위처 재사용 | Task 6, `useCompany()` 재사용, 새 드롭다운 없음 |
| 직급 목록 3곳 중복 제거 | Task 1 |
| 권한 변경은 재로그인 후 반영(기존과 동일) | 별도 구현 불필요 — JWT가 로그인 시에만 생성되는 기존 구조 그대로 유지 |
