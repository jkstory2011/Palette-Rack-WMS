import './globals.css'
import { cookies } from 'next/headers'
import ErrorBoundary from '@/components/ErrorBoundary'
import Navigation from '@/components/Navigation'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Palette Rack WMS',
  description: '파렛트랙 입출고 관리 시스템',
}

export default async function RootLayout({ children }) {
  const jar         = cookies()
  const devAdmin    = jar.get('wms_auth')?.value === '1'
  const userToken   = jar.get('wms_user')?.value
  const userPayload = userToken ? await verifyToken(userToken) : null

  const isLoggedIn  = devAdmin || userPayload !== null
  const isAdmin     = devAdmin || userPayload?.role === 'admin'
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

        {isLoggedIn && (
          <header className="no-print sticky top-0 z-40 flex items-center justify-between px-5 h-[52px]"
            style={{
              background: 'rgba(4,6,16,0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 1px 0 rgba(99,102,241,0.08), 0 8px 32px rgba(0,0,0,0.4)',
            }}>

            {/* 브랜드 */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black
                              tracking-tight text-white select-none"
                style={{
                  background: 'linear-gradient(135deg,#4338ca,#818cf8)',
                  boxShadow: '0 0 14px rgba(99,102,241,0.45)',
                  fontFamily: 'ui-monospace,monospace',
                }}>
                PR
              </div>
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-[13px] font-black text-white tracking-[-0.3px]">Palette Rack</span>
                <span className="text-[9px] font-semibold tracking-[0.18em] uppercase mt-0.5"
                  style={{color:'rgba(99,102,241,0.7)',fontFamily:'ui-monospace,monospace'}}>
                  WMS
                </span>
              </div>
            </div>

            <Navigation
              isAdmin={isAdmin}
              displayName={displayName}
              position={position}
            />
          </header>
        )}

        <main className={isLoggedIn ? 'p-4 sm:p-6' : ''}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  )
}
