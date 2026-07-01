'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCompany } from '@/context/CompanyContext'

export default function AdminPage() {
  const [stats, setStats] = useState({ pending: 0, active: 0, inactive: 0 })
  const [companyStats, setCompanyStats] = useState([])
  const { isSuperAdmin, companies } = useCompany() ?? {}

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return
        setStats({
          pending:  data.filter(u => !u.is_approved).length,
          active:   data.filter(u => u.is_approved && u.is_active).length,
          inactive: data.filter(u => u.is_approved && !u.is_active).length,
        })
        if (isSuperAdmin && companies?.length) {
          const byCompany = companies.map(co => ({
            ...co,
            users: data.filter(u => u.company_id === co.id).length,
            pending: data.filter(u => u.company_id === co.id && !u.is_approved).length,
          }))
          setCompanyStats(byCompany)
        }
      })
      .catch(() => {})
  }, [isSuperAdmin, companies])

  const cards = [
    {
      href: '/admin/users',
      icon: '👥',
      title: '회원 관리',
      desc: '가입 승인, 직급·권한 설정, 비밀번호 초기화, 계정 관리',
      badge: stats.pending > 0 ? { text: `대기 ${stats.pending}`, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' } : null,
      stats: [
        { label: '승인 대기', value: stats.pending, color: 'text-yellow-400' },
        { label: '활성',      value: stats.active,   color: 'text-emerald-400' },
        { label: '비활성',    value: stats.inactive,  color: 'text-slate-500'  },
      ],
    },
    {
      href: '/admin/employees',
      icon: '🏢',
      title: '직원 등록',
      desc: '직원 정보 등록 및 관리',
      badge: null,
      stats: [],
    },
    {
      href: '/admin/clients',
      icon: '🤝',
      title: '화주사 등록',
      desc: '화주사 정보 및 사업자등록증 관리',
      badge: null,
      stats: [],
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">
          Administration
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">관리 홈</h1>
      </div>

      {/* Superadmin: 회사별 현황 */}
      {isSuperAdmin && companyStats.length > 0 && (
        <div style={{
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: '12px',
          padding: '16px 20px',
        }}>
          <div className="flex items-center gap-2 mb-3">
            <div style={{
              width: '20px', height: '20px',
              background: '#7C3AED', borderRadius: '5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: '900', color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
            }}>SA</div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#A78BFA', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>
              SUPERADMIN — 회사별 현황
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {companyStats.map(co => (
              <div key={co.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '36px', height: '36px', flexShrink: 0,
                  background: '#F59E0B', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '900', color: '#000',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{co.code}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#E8EAED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {co.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                    계정 <span style={{ color: '#94A3B8', fontWeight: '600' }}>{co.users}</span>명
                    {co.pending > 0 && (
                      <span style={{ marginLeft: '8px', color: '#F59E0B' }}>승인대기 {co.pending}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(card => (
          <Link key={card.href} href={card.href}
            className="wms-card group flex flex-col gap-4 hover:border-indigo-500/30 transition-all duration-200 cursor-pointer"
            style={{ textDecoration: 'none' }}>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{card.icon}</span>
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">{card.title}</h2>
                  <p className="text-slate-500 text-xs mt-0.5">{card.desc}</p>
                </div>
              </div>
              {card.badge && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${card.badge.color}`}>
                  {card.badge.text}
                </span>
              )}
            </div>

            {card.stats.length > 0 && (
              <div className="flex gap-4 pt-2 border-t border-white/[0.06]">
                {card.stats.map(s => (
                  <div key={s.label} className="flex flex-col gap-0.5">
                    <span className={`text-xl font-black font-mono ${s.color}`}>{s.value}</span>
                    <span className="text-xs text-slate-600">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end text-xs text-slate-600 group-hover:text-indigo-400 transition-colors">
              바로가기 →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
