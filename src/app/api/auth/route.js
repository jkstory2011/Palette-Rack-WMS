import { NextResponse } from 'next/server'

export async function POST(request) {
  const { password } = await request.json()

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('wms_auth', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일 유지
    path: '/',
  })
  return response
}
