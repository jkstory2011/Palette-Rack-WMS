import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth']
const ADMIN_PATHS  = ['/admin', '/api/admin']

export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 개발관리자 쿠키 (일반 페이지 접근은 어디서든 허용)
  const devAdmin = request.cookies.get('wms_auth')?.value === '1'

  // JWT 인증
  const userToken = request.cookies.get('wms_user')?.value
  const user      = userToken ? await verifyToken(userToken) : null

  const isAuthed = devAdmin || user !== null
  const isAdmin = devAdmin || user?.role === 'admin'

  // 관리자 전용 경로
  if (ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (!isAuthed) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
