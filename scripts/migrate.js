/**
 * 자동 마이그레이션 스크립트
 * Vercel 빌드 시 `next build` 전에 실행됨
 *
 * 동작 방식:
 *  1. supabase/migrations/ 의 *.sql 파일을 번호 순 정렬
 *  2. _migrations 테이블에서 이미 적용된 항목 조회
 *  3. 미적용 항목만 exec_migration() RPC로 실행
 *  4. 성공 시 _migrations에 기록
 */

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || supabaseUrl.includes('placeholder') || !serviceKey) {
  console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY 미설정 → 마이그레이션 건너뜀')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations')

async function run() {
  // 마이그레이션 파일 목록 (번호 순 정렬)
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  if (files.length === 0) {
    console.log('마이그레이션 파일 없음')
    return
  }

  // 이미 적용된 마이그레이션 조회
  const { data: applied, error: fetchErr } = await supabase
    .from('_migrations')
    .select('name')

  if (fetchErr) {
    console.error('❌ _migrations 테이블 조회 실패:', fetchErr.message)
    console.error('   → supabase/setup_migrations.sql 을 Supabase SQL Editor에서 먼저 실행하세요.')
    process.exit(1)
  }

  const appliedSet = new Set((applied ?? []).map(r => r.name))

  const pending = files.filter(f => !appliedSet.has(f))

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
      console.error(`\n❌ 실패: ${error.message}`)
      process.exit(1)
    }

    const { error: recordErr } = await supabase
      .from('_migrations')
      .insert({ name: file })

    if (recordErr) {
      console.error(`\n❌ 기록 실패: ${recordErr.message}`)
      process.exit(1)
    }

    console.log('완료')
  }

  console.log(`\n✅ ${pending.length}개 마이그레이션 적용 완료`)
}

run().catch(err => {
  console.error('마이그레이션 오류:', err)
  process.exit(1)
})
