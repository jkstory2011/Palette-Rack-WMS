import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const jar       = cookies()
  const userToken = jar.get('wms_user')?.value
  const user      = userToken ? await verifyToken(userToken) : null

  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { companyId } = await req.json()
  const res = NextResponse.json({ ok: true })

  if (companyId) {
    res.cookies.set('wms_active_company', String(companyId), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })
  } else {
    res.cookies.delete('wms_active_company')
  }

  return res
}
