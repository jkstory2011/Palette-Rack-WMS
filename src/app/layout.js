import './globals.css'
import { cookies } from 'next/headers'
import ErrorBoundary from '@/components/ErrorBoundary'
import AuthButton from '@/components/LogoutButton'
import { verifyToken } from '@/lib/auth'

// 모든 페이지 동적 렌더링 강제 — 빌드 시 Supabase 프리렌더 오류 방지
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Palette Rack WMS',
  description: '파렛트랙 입출고 관리 시스템',
}

export default async function RootLayout({ children }) {
  const jar       = cookies()
  const devAdmin  = jar.get('wms_auth')?.value === '1'
  const userToken = jar.get('wms_user')?.value
  const userPayload = userToken ? await verifyToken(userToken) : null

  const isLoggedIn = devAdmin || userPayload !== null
  const isAdmin    = devAdmin || userPayload?.role === 'admin'
  const displayName = devAdmin ? '개발관리자' : (userPayload?.displayName ?? null)
  const position    = devAdmin ? '' : (userPayload?.position ?? '')

  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-950">
        {/* 전역 도트 그리드 배경 */}
        <div className="fixed inset-0 pointer-events-none -z-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.065) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

        {/* 로그인 상태일 때만 헤더 표시 */}
        {isLoggedIn && (
          <header className="no-print sticky top-0 z-40 flex items-center justify-between px-6 h-14"
            style={{
              background: 'rgba(6,9,20,0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
            <div className="flex items-center gap-3">
              <span className="text-base font-black tracking-tight text-white">
                📦 Palette Rack WMS
              </span>
              <span className="text-[11px] font-medium text-slate-600 hidden sm:block tracking-wider">
                파렛트랙 입출고 관리 시스템
              </span>
            </div>

            <nav className="flex items-center gap-0.5 flex-wrap">
              <NavLink href="/">🗺 조감도</NavLink>
              <NavLink href="/inbound">📥 입고</NavLink>
              <NavLink href="/outbound">🚛 출고</NavLink>
              <NavLink href="/production">🏭 B2B생산</NavLink>
              <NavLink href="/work-orders">📝 작업지시서</NavLink>
              <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
              <NavLink href="/products">📋 상품</NavLink>
              <NavLink href="/locations">📍 로케이션</NavLink>
              <NavLink href="/logs">📜 이력</NavLink>
              {isAdmin && (
                <>
                  <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
                  <NavLink href="/admin">⚙ 관리</NavLink>
                </>
              )}
              <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
              {displayName && (
                <span className="hidden sm:flex items-center gap-1.5 px-2">
                  {position && (
                    <span className="text-[11px] text-slate-500 bg-white/5 border border-white/10
                                     px-2 py-0.5 rounded-full">{position}</span>
                  )}
                  <span className="text-xs text-slate-300 font-medium">{displayName}</span>
                </span>
              )}
              <AuthButton isLoggedIn={isLoggedIn} />
            </nav>
          </header>
        )}

        {/* 로그인 시 여백, 비로그인(로그인/회원가입 페이지)은 패딩 없음 */}
        <main className={isLoggedIn ? 'p-4 sm:p-6' : ''}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  )
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400
                 hover:bg-white/[0.06] hover:text-white transition-colors
                 min-h-[40px] flex items-center"
    >
      {children}
    </a>
  )
}
