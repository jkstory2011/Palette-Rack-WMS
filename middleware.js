import { NextResponse } from 'next/server'

const COOKIE_NAME  = 'wms_auth'
const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const auth = request.cookies.get(COOKIE_NAME)
  if (!auth || auth.value !== '1') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
