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

// ── 메뉴 구조 정의
const OP_ITEMS = [
  {
    key: 'dashboard', href: '/', label: '조감도', Icon: IconGrid,
    subItems: [
      { href: '/', label: '랙 현황' },
    ],
  },
  {
    key: 'inbound', href: '/inbound', label: '입고', Icon: IconInbound,
    subItems: [
      { href: '/inbound?tab=register', label: '입고등록' },
      { href: '/inbound?tab=instruct', label: '입고지시' },
      { href: '/inbound?tab=complete', label: '입고완료' },
    ],
  },
  {
    key: 'outbound', href: '/outbound', label: '출고', Icon: IconOutbound,
    subItems: [
      { href: '/outbound?tab=register', label: '출고등록' },
      { href: '/outbound?tab=instruct', label: '출고지시' },
      { href: '/outbound?tab=complete', label: '출고완료' },
    ],
  },
  {
    key: 'production', href: '/production', label: 'B2B 생산', Icon: IconProduction,
    subItems: [
      { href: '/production?tab=register',    label: '생산등록' },
      { href: '/production?tab=in_progress', label: '생산현황' },
      { href: '/production?tab=completed',   label: '생산완료' },
    ],
  },
  {
    key: 'work-orders', href: '/work-orders', label: '작업지시서', Icon: IconOrder,
    subItems: [
      { href: '/work-orders?tab=orders', label: '오더관리' },
      { href: '/work-orders?tab=logs',   label: '작업이력' },
    ],
  },
]

const MGMT_ITEMS = [
  {
    key: 'products', href: '/products', label: '상품', Icon: IconProduct,
    subItems: [
      { href: '/products', label: '상품목록' },
    ],
  },
  {
    key: 'locations', href: '/locations', label: '로케이션', Icon: IconLocation,
    subItems: [
      { href: '/locations?tab=zone',    label: '구역 현황' },
      { href: '/locations?tab=pallet',  label: '파렛트랙' },
      { href: '/locations?tab=product', label: '상품 로케이션' },
    ],
  },
  {
    key: 'logs', href: '/logs', label: '이력', Icon: IconLog,
    subItems: [
      { href: '/logs?tab=inbound',  label: '입고 이력' },
      { href: '/logs?tab=outbound', label: '출고 이력' },
    ],
  },
]

const SYSTEM_ITEMS = [
  {
    key: 'admin', href: '/admin', label: '관리홈', Icon: IconAdmin,
    subItems: [
      { href: '/admin/users',   label: '회원관리' },
      { href: '/admin/clients', label: '화주사등록' },
    ],
  },
]

export default function Navigation({ isAdmin, displayName, position }) {
  const pathname = usePathname()

  const isActive = (href) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  // 현재 경로에 해당하는 항목 key 자동 열기
  const getInitialOpen = () => {
    const all = [...OP_ITEMS, ...MGMT_ITEMS, ...SYSTEM_ITEMS]
    const open = {}
    all.forEach(item => {
      if (isActive(item.href)) open[item.key] = true
    })
    return open
  }

  const [open, setOpen] = useState(getInitialOpen)

  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }))

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
          width: '32px', height: '32px', flexShrink: 0,
          background: '#F59E0B', borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: '900', color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '-0.02em',
        }}>
          PR
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
            Palette Rack WMS
          </div>
          <div style={{ fontSize: '10.5px', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', marginTop: '1px' }}>
            파렛트랙 관리시스템
          </div>
        </div>
      </div>

      {/* ── 운영 */}
      <div style={{ paddingTop: '20px' }}>
        <SectionLabel>운영</SectionLabel>
        {OP_ITEMS.map(item => (
          <AccordionItem
            key={item.key}
            item={item}
            expanded={!!open[item.key]}
            onToggle={() => toggle(item.key)}
            isActive={isActive}
            pathname={pathname}
          />
        ))}
      </div>

      {/* ── 관리 */}
      <div style={{ paddingTop: '20px' }}>
        <SectionLabel>관리</SectionLabel>
        {MGMT_ITEMS.map(item => (
          <AccordionItem
            key={item.key}
            item={item}
            expanded={!!open[item.key]}
            onToggle={() => toggle(item.key)}
            isActive={isActive}
            pathname={pathname}
          />
        ))}
      </div>

      {/* ── 시스템 (관리자 전용) */}
      {isAdmin && (
        <div style={{ paddingTop: '20px' }}>
          <SectionLabel>시스템</SectionLabel>
          {SYSTEM_ITEMS.map(item => (
            <AccordionItem
              key={item.key}
              item={item}
              expanded={!!open[item.key]}
              onToggle={() => toggle(item.key)}
              isActive={isActive}
              pathname={pathname}
            />
          ))}
        </div>
      )}

      {/* ── 사용자 + 로그아웃 */}
      <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
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

// ── 섹션 라벨 (비클릭)
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#4E5A6A',
      fontFamily: "'JetBrains Mono', monospace",
      padding: '0 16px 6px',
    }}>
      {children}
    </div>
  )
}

// ── 아코디언 상위 메뉴 + 서브메뉴
function AccordionItem({ item, expanded, onToggle, isActive, pathname }) {
  const { href, label, Icon, subItems } = item
  const parentActive = isActive(href)

  return (
    <div>
      {/* 상위 메뉴 행 */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          margin: '0 4px', borderRadius: '0 6px 6px 0',
          borderLeft: parentActive ? '2px solid #F59E0B' : '2px solid transparent',
          background: parentActive ? 'rgba(245,158,11,0.12)' : 'transparent',
          transition: 'all 0.13s',
        }}
        onMouseEnter={e => {
          if (!parentActive) {
            e.currentTarget.style.background = 'rgba(245,158,11,0.08)'
          }
        }}
        onMouseLeave={e => {
          if (!parentActive) {
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {/* 아이콘 + 라벨 (클릭 시 토글) */}
        <button
          onClick={onToggle}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '9px',
            padding: '9px 0 9px 12px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: parentActive ? '#F59E0B' : '#9AA5B4',
            fontSize: '13.5px', fontWeight: '500',
            textAlign: 'left', minHeight: '36px',
            transition: 'color 0.13s',
          }}
        >
          <span style={{ opacity: parentActive ? 1 : 0.65, flexShrink: 0 }}><Icon /></span>
          <span style={{ flex: 1 }}>{label}</span>
        </button>

        {/* 화살표 토글 버튼 */}
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: parentActive ? '#F59E0B' : '#4E5A6A',
            padding: '9px 12px 9px 4px',
            display: 'flex', alignItems: 'center',
            minHeight: 'auto', minWidth: 'auto',
            transition: 'color 0.13s',
          }}
        >
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: 'transform 0.18s ease',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            <path d="M1 3l4 4 4-4" />
          </svg>
        </button>
      </div>

      {/* 서브메뉴 */}
      {expanded && subItems && (
        <div>
          {subItems.map((sub, i) => {
            const subActive = sub.href === '/'
              ? pathname === '/'
              : pathname === sub.href || pathname.startsWith(sub.href + '/')
            return (
              <a
                key={i}
                href={sub.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '6px 14px 6px 28px', margin: '0 4px',
                  borderRadius: '0 6px 6px 0',
                  color: subActive ? '#F59E0B' : '#4E5A6A',
                  background: subActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                  borderLeft: subActive ? '2px solid #F59E0B' : '2px solid transparent',
                  fontSize: '12.5px', fontWeight: '500',
                  textDecoration: 'none', cursor: 'pointer',
                  transition: 'all 0.13s',
                  minHeight: '30px',
                }}
                onMouseEnter={e => {
                  if (!subActive) {
                    e.currentTarget.style.background = 'rgba(245,158,11,0.05)'
                    e.currentTarget.style.color = '#9AA5B4'
                  }
                }}
                onMouseLeave={e => {
                  if (!subActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#4E5A6A'
                  }
                }}
              >
                <span style={{ fontSize: '10px', opacity: 0.3, flexShrink: 0, lineHeight: 1 }}>└</span>
                {sub.label}
              </a>
            )
          })}
        </div>
      )}
    </div>
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
