import { NextResponse } from 'next/server'

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   0,
  path:     '/',
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('wms_auth', '', COOKIE_OPTS)
  response.cookies.set('wms_user', '', COOKIE_OPTS)
  return response
}
