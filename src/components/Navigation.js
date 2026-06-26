'use client'

import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const OP_LINKS = [
  { href: '/',            label: '조감도',     icon: '🗺'  },
  { href: '/inbound',     label: '입고',       icon: '📥'  },
  { href: '/outbound',    label: '출고',       icon: '🚛'  },
  { href: '/production',  label: 'B2B생산',    icon: '🏭'  },
  { href: '/work-orders', label: '작업지시서',  icon: '📝'  },
]
const MGMT_LINKS = [
  { href: '/products',  label: '상품',     icon: '📋' },
  { href: '/locations', label: '로케이션',  icon: '📍' },
  { href: '/logs',      label: '이력',     icon: '📜' },
]

export default function Navigation({ isAdmin, displayName, position }) {
  const pathname = usePathname()

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="flex items-center gap-0.5">
      {/* 운영 그룹 */}
      {OP_LINKS.map(link => (
        <NavLink key={link.href} href={link.href} active={isActive(link.href)}
          icon={link.icon}>{link.label}</NavLink>
      ))}

      <Sep />

      {/* 관리 그룹 */}
      {MGMT_LINKS.map(link => (
        <NavLink key={link.href} href={link.href} active={isActive(link.href)}
          icon={link.icon}>{link.label}</NavLink>
      ))}

      {isAdmin && (
        <>
          <Sep />
          <NavLink href="/admin" active={isActive('/admin')} icon="⚙">관리</NavLink>
        </>
      )}

      <Sep />

      {/* 사용자 정보 */}
      {displayName && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          {position && (
            <span className="text-[10px] font-bold tracking-[0.08em] px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)',
                color: '#a5b4fc',
              }}>
              {position}
            </span>
          )}
          <span className="text-[13px] font-semibold text-slate-200 hidden sm:block">
            {displayName}
          </span>
        </div>
      )}

      {/* 로그아웃 */}
      <LogoutBtn />
    </nav>
  )
}

function NavLink({ href, active, icon, children }) {
  return (
    <a href={href}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                 text-[13px] font-medium transition-all duration-150"
      style={active ? {
        color: '#c7d2fe',
        background: 'rgba(99,102,241,0.13)',
        border: '1px solid rgba(99,102,241,0.22)',
        boxShadow: '0 0 12px rgba(99,102,241,0.12)',
      } : {
        color: 'rgba(100,116,139,1)',
        background: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = 'rgba(226,232,240,1)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = 'rgba(100,116,139,1)'
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.border = '1px solid transparent'
        }
      }}>
      <span className="text-[14px] leading-none">{icon}</span>
      <span className="hidden sm:block">{children}</span>
      {active && (
        <span className="absolute bottom-[-9px] left-1/2 -translate-x-1/2 h-[2px] rounded-full hidden sm:block"
          style={{
            width: 'calc(100% - 16px)',
            background: 'linear-gradient(90deg,transparent,rgba(129,140,248,0.9),transparent)',
            boxShadow: '0 0 8px rgba(99,102,241,0.7)',
          }} />
      )}
    </a>
  )
}

function Sep() {
  return (
    <div className="hidden sm:block mx-1.5 w-px h-4 rounded-full"
      style={{ background: 'linear-gradient(to bottom,transparent,rgba(99,102,241,0.25),transparent)' }} />
  )
}

function LogoutBtn() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button onClick={handleLogout} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium
                 transition-all duration-150 ml-0.5"
      style={{
        color: 'rgba(100,116,139,1)',
        background: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#fca5a5'
        e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
        e.currentTarget.style.border = '1px solid rgba(239,68,68,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'rgba(100,116,139,1)'
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.border = '1px solid transparent'
      }}>
      <span className="text-[14px]">🔒</span>
      <span className="hidden sm:block">{loading ? '...' : '로그아웃'}</span>
    </button>
  )
}
