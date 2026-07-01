import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const { username, password } = await req.json()

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { data: user, error: fetchErr } = await db
    .from('wms_users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .single()

  if (fetchErr || !user) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }
  if (!user.is_approved) {
    return NextResponse.json({ error: '관리자 승인 대기 중입니다. 관리자에게 문의하세요.' }, { status: 403 })
  }
  if (!user.is_active) {
    return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  await db.from('wms_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)

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

  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set('wms_user', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  })
  return res
}
