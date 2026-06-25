import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req) {
  const { username, displayName, password } = await req.json()

  if (!username?.trim() || !displayName?.trim() || !password) {
    return NextResponse.json({ error: '모든 항목을 입력하세요.' }, { status: 400 })
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())) {
    return NextResponse.json({ error: '아이디는 영문 소문자·숫자·_만 사용, 3~20자.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
  }

  const hash = await bcrypt.hash(password, 10)

  const { error } = await supabaseAdmin.from('wms_users').insert({
    username:      username.trim().toLowerCase(),
    display_name:  displayName.trim(),
    password_hash: hash,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
