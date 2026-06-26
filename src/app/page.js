'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function ArcGauge({ value }) {
  const r     = 52
  const circ  = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(value, 100) / 100)
  const color  = value >= 80 ? '#f87171' : value > 0 ? '#fbbf24' : '#34d399'
  const glow   = value >= 80 ? '#f87171' : value > 0 ? '#f59e0b' : '#10b981'

  return (
    <svg width="134" height="134" viewBox="0 0 134 134" style={{ overflow: 'visible' }}>
      <circle cx="67" cy="67" r="63" fill="none"
        stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      <circle cx="67" cy="67" r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx="67" cy="67" r={r} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        transform="rotate(-90 67 67)"
        style={{
          transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease',
          filter: `drop-shadow(0 0 10px ${glow})`,
        }} />
      <text x="67" y="60" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="22" fontWeight="900" fontFamily="ui-monospace, monospace"
        letterSpacing="-0.5">
        {value.toFixed(1)}
      </text>
      <text x="67" y="78" textAnchor="middle"
        fill="rgba(148,163,184,1)" fontSize="11"
        fontFamily="ui-sans-serif, sans-serif" fontWeight="600" letterSpacing="2">
        가동률%
      </text>
    </svg>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="dash-card rounded-2xl p-5 flex flex-col gap-2"
      style={{ border: '1px solid rgba(255,255,255,0.055)' }}>
      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-slate-400">{label}</p>
      <p className="text-3xl font-black leading-none"
        style={{ color, fontFamily: 'ui-monospace, monospace' }}>
        {value}
      </p>
    </div>
  )
}

function ZoneCard({ zone }) {
  const pct       = zone.usedRate * 100
  const isFull    = zone.usedRate >= 0.8
  const isPartial = zone.usedRate > 0 && zone.usedRate < 0.8
  const accentColor = isFull ? '#f87171' : isPartial ? '#fbbf24' : '#34d399'
  const cardCls   = isFull ? 'dash-zone-full' : isPartial ? 'dash-zone-partial' : 'dash-zone-empty'
  const labelCls  = isFull
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : isPartial
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  const label = isFull ? '만석' : isPartial ? '일부' : '여유'

  return (
    <Link
      href={`/zone/${zone.code}`}
      className={`group dash-card ${cardCls} relative flex flex-col gap-3 rounded-2xl p-5
                  transition-all duration-300 hover:scale-[1.025] hover:-translate-y-0.5 cursor-pointer`}
    >
      {/* Left accent strip */}
      <div className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
        style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />

      {/* Zone code + badge */}
      <div className="flex items-start justify-between pl-1">
        <span className="text-4xl font-black tracking-tighter text-white"
          style={{ fontFamily: 'ui-monospace, monospace' }}>
          {zone.code}
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${labelCls}`}>
          {label}
        </span>
      </div>

      {/* Zone name */}
      <p className="text-sm text-slate-300 truncate pl-1 -mt-1">{zone.name}</p>

      {/* Progress bar */}
      <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-white/[0.05]">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
            boxShadow: `0 0 6px ${accentColor}80`,
          }} />
      </div>

      {/* Stats row */}
      <div className="flex items-end justify-between pl-1">
        <span className="text-xs text-slate-400">랙 {zone.locCount}개</span>
        <div className="text-right leading-none">
          <span className="text-2xl font-black"
            style={{ color: accentColor, fontFamily: 'ui-monospace, monospace' }}>
            {Math.round(pct)}
          </span>
          <span className="text-sm text-slate-300" style={{ fontFamily: 'ui-monospace, monospace' }}>%</span>
          <span className="text-xs text-slate-400 ml-1">{zone.used}/{zone.total}</span>
        </div>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const [zones, setZones]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchZoneStats = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('zones')
      .select(`id, code, name, locations ( id, pallets ( id, status ) )`)
      .order('code')

    if (err) { setError(err.message); setLoading(false); return }

    const computed = (data ?? []).map((zone) => {
      const locations  = zone.locations ?? []
      const totalSlots = locations.length * 8
      const usedSlots  = locations.reduce(
        (sum, loc) => sum + (loc.pallets ?? []).filter((p) => p.status === 'stored').length,
        0,
      )
      return {
        id: zone.id, code: zone.code, name: zone.name,
        total: totalSlots, used: usedSlots,
        usedRate: totalSlots > 0 ? usedSlots / totalSlots : 0,
        locCount: locations.length,
      }
    })

    setZones(computed)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchZoneStats()
    const channel = supabase
      .channel('dashboard-pallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, fetchZoneStats)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchZoneStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-7 h-7 border-2 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 text-xs tracking-[0.2em] uppercase font-mono">Loading</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm">데이터 조회 오류</p>
        <p className="text-slate-600 text-xs">{error}</p>
        <button onClick={fetchZoneStats}
          className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm
                     transition-colors border border-white/10">
          다시 시도
        </button>
      </div>
    )
  }

  const totalSlots  = zones.reduce((s, z) => s + z.total, 0)
  const usedSlots   = zones.reduce((s, z) => s + z.used, 0)
  const freeSlots   = totalSlots - usedSlots
  const overallRate = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0
  const barColor    = overallRate >= 80
    ? 'linear-gradient(90deg, #fbbf24, #f87171)'
    : 'linear-gradient(90deg, #34d399, #fbbf24)'
  const barGlow = overallRate >= 80 ? 'rgba(248,113,113,0.4)' : 'rgba(52,211,153,0.35)'

  return (
    <div className="space-y-5 relative">

      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">
            Warehouse Overview
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">
            전체 창고 조감도
          </h1>
        </div>
        <div className="text-right space-y-0.5 no-print">
          {lastUpdated && (
            <p className="text-xs text-slate-400 font-mono">
              {lastUpdated.toLocaleTimeString('ko-KR')}
            </p>
          )}
          <button onClick={fetchZoneStats}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors
                       font-mono flex items-center gap-1 ml-auto">
            ↻ 새로고침
          </button>
        </div>
      </div>

      {/* ── Stats + Arc Gauge ── */}
      <div className="grid grid-cols-4 gap-4 items-stretch">
        <StatCard label="전체 슬롯" value={totalSlots.toLocaleString()} color="#818cf8" />
        <StatCard
          label="사용 중"
          value={usedSlots.toLocaleString()}
          color={overallRate >= 80 ? '#f87171' : '#fbbf24'}
        />
        <StatCard label="여유 슬롯" value={freeSlots.toLocaleString()} color="#34d399" />

        <div className="dash-card rounded-2xl flex items-center justify-center"
          style={{ border: '1px solid rgba(255,255,255,0.055)', minHeight: '120px' }}>
          <ArcGauge value={overallRate} />
        </div>
      </div>

      {/* ── Overall progress bar ── */}
      <div className="dash-card rounded-2xl px-5 py-4 space-y-2.5"
        style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold tracking-[0.1em] uppercase text-slate-400 font-mono">
            전체 가동률
          </span>
          <span className="text-xs font-mono text-slate-300">
            {usedSlots.toLocaleString()} / {totalSlots.toLocaleString()} 슬롯
          </span>
        </div>
        <div className="relative w-full h-2 rounded-full overflow-hidden bg-white/[0.04]">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
            style={{
              width: `${Math.max(overallRate, 0)}%`,
              background: barColor,
              boxShadow: `0 0 14px ${barGlow}`,
            }} />
        </div>
      </div>

      {/* ── Zone grid ── */}
      {zones.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm mb-3">등록된 구역이 없습니다.</p>
          <Link href="/locations"
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
            📍 로케이션 관리에서 구역을 추가하세요
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {zones.map((zone) => <ZoneCard key={zone.id} zone={zone} />)}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex items-center gap-5 no-print pt-1">
        {[
          { color: '#34d399', label: '여유' },
          { color: '#fbbf24', label: '일부 사용' },
          { color: '#f87171', label: '만석 (80%+)' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
