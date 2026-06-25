/**
 * 자동 마이그레이션 스크립트
 * Vercel 빌드 시 `next build` 전에 실행됨
 *
 * 동작 방식:
 *  SUPABASE_ACCESS_TOKEN 있을 때 → Management API로 완전 자동 실행
 *  없을 때 → RPC(exec_migration) 방식으로 시도, 실패해도 빌드는 계속
 */

const { createClient } = require('@supabase/supabase-js')
const https  = require('https')
const fs     = require('fs')
const path   = require('path')

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY  || ''
const accessToken = process.env.SUPABASE_ACCESS_TOKEN      || ''

// 환경변수 없으면 건너뜀
if (!supabaseUrl || !serviceKey) {
  console.log('⚠️  Supabase 환경변수 미설정 → 마이그레이션 건너뜀')
  process.exit(0)
}

// 프로젝트 ref 추출 (https://xxxx.supabase.co → xxxx)
const projectRef = supabaseUrl.replace('https://', '').split('.')[0]

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations')

// ── Management API로 임의 SQL 실행
function managementQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql })
    const req  = https.request({
      hostname: 'api.supabase.com',
      path:     `/v1/projects/${projectRef}/database/query`,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', (c) => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode >= 400) reject(new Error(json.message || JSON.stringify(json)))
          else resolve(json)
        } catch {
          reject(new Error(`응답 파싱 오류: ${data}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Management API 모드: _migrations + exec_migration 자동 부트스트랩
async function bootstrapViaManagementApi() {
  console.log('🔑 SUPABASE_ACCESS_TOKEN 감지 → Management API 모드로 실행')

  const setupSql = fs.readFileSync(
    path.join(__dirname, '../supabase/setup_migrations.sql'), 'utf-8'
  )
  await managementQuery(setupSql)
  console.log('✅ _migrations 테이블 및 exec_migration 함수 준비 완료')
}

async function run() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('마이그레이션 파일 없음')
    return
  }

  // Management API 토큰이 있으면 부트스트랩 먼저
  if (accessToken) {
    try {
      await bootstrapViaManagementApi()
    } catch (err) {
      console.warn('⚠️  부트스트랩 경고 (이미 존재할 수 있음):', err.message)
    }
  }

  // _migrations 테이블 조회
  const { data: applied, error: fetchErr } = await supabase.from('_migrations').select('name')

  if (fetchErr) {
    console.warn('⚠️  _migrations 테이블 없음 → 마이그레이션 건너뜀')
    console.warn('   SUPABASE_ACCESS_TOKEN 환경변수를 설정하면 자동 실행됩니다.')
    process.exit(0)  // 빌드는 계속 진행
  }

  const appliedSet = new Set((applied ?? []).map(r => r.name))
  const pending    = files.filter(f => !appliedSet.has(f))

  if (pending.length === 0) {
    console.log('✅ 모든 마이그레이션이 최신 상태입니다.')
    return
  }

  console.log(`📦 미적용 마이그레이션 ${pending.length}개 발견`)

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    process.stdout.write(`  ▶ ${file} ... `)

    const { error } = await supabase.rpc('exec_migration', { migration_sql: sql })
    if (error) {
      // Management API 모드면 직접 실행으로 재시도
      if (accessToken) {
        try {
          await managementQuery(sql)
        } catch (e2) {
          console.warn(`\n⚠️  건너뜀: ${e2.message}`)
          continue
        }
      } else {
        console.warn(`\n⚠️  건너뜀 (exec_migration 없음): ${error.message}`)
        continue
      }
    }

    const { error: recordErr } = await supabase.from('_migrations').insert({ name: file })
    if (recordErr) console.warn(`\n⚠️  기록 실패 (무시): ${recordErr.message}`)
    else console.log('완료')
  }

  console.log(`\n✅ 마이그레이션 완료`)
}

run().catch(err => {
  console.warn('⚠️  마이그레이션 오류 (빌드는 계속):', err.message)
  process.exit(0)  // 마이그레이션 실패해도 빌드는 중단하지 않음
})
