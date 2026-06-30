'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'

// ── SVG 아이콘
const IconGrid       = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
const IconInbound    = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1L1 5v1h14V5L8 1zM2 7v7h3v-4h6v4h3V7H2z"/></svg>
const IconOutbound   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 4h12l1 2v6H1V6l1-2zm2-2h8v2H4V2z"/></svg>
const IconProduction = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 15V8l3-3 2 2 2-2 2 2 2-2 3 3v7H1zm2-2h2v-3H3v3zm3 0h2v-4H6v4zm3 0h2v-3H9v3z"/></svg>
const IconOrder      = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm1 2v2h8V3H4zm0 4v1h8V7H4zm0 3v1h5v-1H4z"/></svg>
const IconProduct    = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z"/></svg>
const IconLocation   = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z"/></svg>
const IconLog        = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 3.5V8.3l2.5 1.5-.8 1.2L7 9V4.5h2z"/></svg>
const IconAdmin      = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a2.5 2.5 0 00-2.4 1.8L4 2.5 3 4l1.2 1.2A4 4 0 004 6.5a4 4 0 00.2 1.3L3 9l1 1.5 1.6-.7A4 4 0 008 11a4 4 0 002.4-.7l1.6.7L13 9l-1.2-1.2A4 4 0 0012 6.5a4 4 0 00-.2-1.3L13 4l-1-1.5-1.6.7A4 4 0 008 3a4 4 0 00-.6 0V0H8zm0 4a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/></svg>
const IconLogout     = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3v-2H4V4h2V2zm4 3L14 8l-4 3V9H6V7h4V5z"/></svg>

// ── 그룹 정의
const BASE_GROUPS = [
  {
    key: 'ops',
    label: '운영',
    items: [
      { href: '/',            label: '조감도',    Icon: IconGrid       },
      { href: '/inbound',     label: '입고',      Icon: IconInbound    },
      { href: '/outbound',    label: '출고',      Icon: IconOutbound   },
      { href: '/production',  label: 'B2B 생산',  Icon: IconProduction },
      { href: '/work-orders', label: '작업지시서', Icon: IconOrder      },
    ],
  },
  {
    key: 'mgmt',
    label: '관리',
    items: [
      { href: '/products',  label: '상품',    Icon: IconProduct  },
      { href: '/locations', label: '로케이션', Icon: IconLocation },
      { href: '/logs',      label: '이력',    Icon: IconLog      },
    ],
  },
]

const SYSTEM_GROUP = {
  key: 'system',
  label: '시스템',
  items: [
    {
      href: '/admin',
      label: '관리홈',
      Icon: IconAdmin,
      subItems: [{ href: '/admin/users', label: '회원관리' }],
    },
  ],
}

export default function Navigation({ isAdmin, displayName, position }) {
  const pathname = usePathname()

  const isActive  = (href) => href === '/' ? pathname === '/' : pathname.startsWith(href)
  const isExact   = (href) => pathname === href

  const groups = isAdmin ? [...BASE_GROUPS, SYSTEM_GROUP] : BASE_GROUPS

  // 현재 경로가 포함된 그룹만 초기 열림
  const [expanded, setExpanded] = useState(() => {
    const init = {}
    groups.forEach(g => {
      init[g.key] = g.items.some(item =>
        isActive(item.href) || (item.subItems ?? []).some(s => isActive(s.href))
      )
    })
    // 아무것도 열리지 않으면 운영만 열기
    if (!Object.values(init).some(Boolean)) init['ops'] = true
    return init
  })

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const initial = displayName ? displayName[0] : '?'

  return (
    <aside
      className="no-print hidden md:flex flex-col shrink-0"
      style={{
        width: '220px',
        background: '#13161D',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ── 브랜드 */}
      <div style={{
        height: '56px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          width: '30px', height: '30px', flexShrink: 0,
          background: '#F59E0B', borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: '800', color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          PR
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#E8EAED', letterSpacing: '-0.01em', lineHeight: '1.2' }}>
            Palette Rack WMS
          </div>
          <div style={{ fontSize: '9.5px', color: '#4E5A6A', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
            파렛트랙 관리시스템
          </div>
        </div>
      </div>

      {/* ── 메뉴 그룹 */}
      <div style={{ flex: 1, paddingTop: '12px', overflowY: 'auto' }}>
        {groups.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            expanded={!!expanded[group.key]}
            onToggle={() => toggle(group.key)}
            isActive={isActive}
            isExact={isExact}
            pathname={pathname}
          />
        ))}
      </div>

      {/* ── 사용자 + 로그아웃 */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px', background: '#1A1E28', borderRadius: '8px',
        }}>
          <div style={{
            width: '28px', height: '28px', flexShrink: 0,
            borderRadius: '50%', background: '#F59E0B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '700', color: '#000',
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#E8EAED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName || '사용자'}
            </div>
            <div style={{ fontSize: '10px', color: '#4E5A6A', fontFamily: "'JetBrains Mono', monospace" }}>
              {position || 'USER'}
            </div>
          </div>
          <LogoutBtn />
        </div>
      </div>
    </aside>
  )
}

// ── 접히는 그룹
function NavGroup({ group, expanded, onToggle, isActive, isExact, pathname }) {
  const hasActive = group.items.some(item =>
    isActive(item.href) || (item.subItems ?? []).some(s => isActive(s.href))
  )

  return (
    <div style={{ marginBottom: '6px' }}>
      {/* 그룹 헤더 (클릭으로 토글) */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '4px 16px 6px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: hasActive ? '#F59E0B' : '#4E5A6A',
          fontFamily: "'JetBrains Mono', monospace",
          transition: 'color 0.13s',
          minHeight: 'auto', minWidth: 'auto',
        }}
        onMouseEnter={e => { if (!hasActive) e.currentTarget.style.color = '#9AA5B4' }}
        onMouseLeave={e => { if (!hasActive) e.currentTarget.style.color = '#4E5A6A' }}
      >
        <span>{group.label}</span>
        {/* 화살표 */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          style={{
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        >
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* 메뉴 아이템 목록 */}
      {expanded && (
        <div>
          {group.items.map(({ href, label, Icon, subItems }) => {
            // subItems가 있으면 정확히 일치할 때만 부모 활성, 없으면 startsWith
            const active = subItems?.length ? pathname === href : isActive(href)
            return (
              <div key={href}>
                <NavItem href={href} active={active} Icon={Icon}>{label}</NavItem>
                {subItems?.map(sub => (
                  <SubNavItem key={sub.href} href={sub.href} active={isActive(sub.href)}>
                    {sub.label}
                  </SubNavItem>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NavItem({ href, active, Icon, children }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '9px 14px 9px 12px', margin: '0 4px',
        borderRadius: '0 6px 6px 0',
        color: active ? '#F59E0B' : '#9AA5B4',
        background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
        borderLeft: active ? '2px solid #F59E0B' : '2px solid transparent',
        fontSize: '13.5px', fontWeight: '500',
        textDecoration: 'none', cursor: 'pointer',
        transition: 'all 0.13s',
        minHeight: '36px', minWidth: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(245,158,11,0.08)'
          e.currentTarget.style.color = '#E8EAED'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#9AA5B4'
        }
      }}
    >
      <span style={{ opacity: active ? 1 : 0.65, flexShrink: 0 }}><Icon /></span>
      {children}
    </a>
  )
}

function SubNavItem({ href, active, children }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px 7px 28px', margin: '0 4px',
        borderRadius: '0 6px 6px 0',
        color: active ? '#F59E0B' : '#4E5A6A',
        background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
        borderLeft: active ? '2px solid #F59E0B' : '2px solid transparent',
        fontSize: '12.5px', fontWeight: '500',
        textDecoration: 'none', cursor: 'pointer',
        transition: 'all 0.13s',
        minHeight: '32px',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(245,158,11,0.05)'
          e.currentTarget.style.color = '#9AA5B4'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#4E5A6A'
        }
      }}
    >
      <span style={{ fontSize: '11px', opacity: 0.35, flexShrink: 0, lineHeight: 1 }}>└</span>
      {children}
    </a>
  )
}

function LogoutBtn() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try { await fetch('/api/auth/logout', { method: 'POST' }) }
    finally { window.location.href = '/login' }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title="로그아웃"
      style={{
        background: 'transparent', border: 'none',
        color: '#4E5A6A', cursor: 'pointer',
        padding: '4px', borderRadius: '4px',
        display: 'flex', alignItems: 'center',
        minHeight: 'auto', minWidth: 'auto', flexShrink: 0,
        transition: 'color 0.13s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
      onMouseLeave={e => { e.currentTarget.style.color = '#4E5A6A' }}
    >
      <IconLogout />
    </button>
  )
}
