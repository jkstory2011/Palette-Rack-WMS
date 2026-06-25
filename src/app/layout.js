import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

// 모든 페이지 동적 렌더링 강제 — 빌드 시 Supabase 프리렌더 오류 방지
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Palette Rack WMS',
  description: '파렛트랙 입출고 관리 시스템',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-950">
        {/* 상단 헤더 */}
        <header className="no-print sticky top-0 z-40 flex items-center justify-between
                           bg-gray-900 border-b border-gray-700 px-6 h-14">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-white">
              📦 Palette Rack WMS
            </span>
            <span className="text-xs text-gray-500 hidden sm:block">
              파렛트랙 입출고 관리 시스템
            </span>
          </div>

          <nav className="flex items-center gap-1 flex-wrap">
            <NavLink href="/">🗺 조감도</NavLink>
            <NavLink href="/inbound">📥 입고</NavLink>
            <NavLink href="/outbound">🚛 출고</NavLink>
            <NavLink href="/work-orders">📝 작업지시서</NavLink>
            <div className="w-px h-5 bg-gray-700 mx-1 hidden sm:block" />
            <NavLink href="/products">📋 상품</NavLink>
            <NavLink href="/locations">📍 로케이션</NavLink>
            <NavLink href="/logs">📜 이력</NavLink>
          </nav>
        </header>

        {/* 메인 컨텐츠 */}
        <main className="p-4 sm:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  )
}

// 간단한 네비게이션 링크 — Next.js Link는 클라이언트 컴포넌트에서 쓰므로 별도 분리
function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300
                 hover:bg-gray-700 hover:text-white transition-colors
                 min-h-[40px] flex items-center"
    >
      {children}
    </a>
  )
}
