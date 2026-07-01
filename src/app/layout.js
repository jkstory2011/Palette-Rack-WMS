import './globals.css'
import { cookies } from 'next/headers'
import ErrorBoundary from '@/components/ErrorBoundary'
import Navigation from '@/components/Navigation'
import { verifyToken } from '@/lib/auth'
import { CompanyProvider } from '@/context/CompanyContext'
import { getSupabaseAdmin } from '@/lib/supabase-server'

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

  const isLoggedIn   = devAdmin || userPayload !== null
  const isSuperAdmin = userPayload?.role === 'superadmin'
  const isAdmin      = devAdmin || userPayload?.role === 'admin' || isSuperAdmin
  const displayName  = devAdmin ? '개발관리자' : (userPayload?.displayName ?? null)
  const position     = devAdmin ? 'DEV_ADMIN' : (userPayload?.position ?? '')

  // 회사 정보 결정
  let activeCompany = null
  let allCompanies  = []

  if (isLoggedIn && !devAdmin) {
    const db = getSupabaseAdmin()

    if (isSuperAdmin) {
      // superadmin: 선택된 회사 쿠키 확인
      const { data: cos } = await db.from('companies').select('id, code, name').order('code')
      allCompanies = cos ?? []

      const activeCid = jar.get('wms_active_company')?.value
      if (activeCid) {
        activeCompany = allCompanies.find(c => c.id === Number(activeCid)) ?? null
      }
    } else if (userPayload?.companyId) {
      // 일반 사용자: JWT의 company 정보
      activeCompany = {
        id:   userPayload.companyId,
        code: userPayload.companyCode,
        name: userPayload.companyName,
      }
    }
  }

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={isLoggedIn ? 'flex h-screen overflow-hidden antialiased' : 'min-h-screen antialiased'}
        style={{ background: '#0C0E13', fontFamily: "'Space Grotesk', ui-sans-serif, sans-serif" }}
      >
        <div
          className="fixed inset-0 pointer-events-none -z-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(245,158,11,0.04) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <CompanyProvider
          company={activeCompany}
          isSuperAdmin={isSuperAdmin}
          companies={allCompanies}
        >
          {isLoggedIn && (
            <Navigation isAdmin={isAdmin} displayName={displayName} position={position} />
          )}

          <div className={isLoggedIn ? 'flex-1 min-w-0 flex flex-col' : ''}>
            <main className={isLoggedIn ? 'flex-1 overflow-y-auto p-5 sm:p-6' : ''}>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </CompanyProvider>
      </body>
    </html>
  )
}
