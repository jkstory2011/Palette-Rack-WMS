'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminPage() {
  const [stats, setStats] = useState({ pending: 0, active: 0, inactive: 0 })

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
      })
      .catch(() => {})
  }, [])

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
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">
          Administration
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">관리 홈</h1>
      </div>

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

            <div className="flex gap-4 pt-2 border-t border-white/[0.06]">
              {card.stats.map(s => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <span className={`text-xl font-black font-mono ${s.color}`}>{s.value}</span>
                  <span className="text-xs text-slate-600">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end text-xs text-slate-600 group-hover:text-indigo-400 transition-colors">
              바로가기 →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
