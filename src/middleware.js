import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth']
const ADMIN_PATHS  = ['/admin', '/api/admin']

export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const devAdmin  = request.cookies.get('wms_auth')?.value === '1'
  const userToken = request.cookies.get('wms_user')?.value
  const user      = userToken ? await verifyToken(userToken) : null

  const isAuthed      = devAdmin || user !== null
  const isSuperAdmin  = user?.role === 'superadmin'
  const isAdmin       = devAdmin || user?.role === 'admin' || isSuperAdmin || user?.isPositionAdmin === true

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|mp4|pdf)).*)',
  ],
}
