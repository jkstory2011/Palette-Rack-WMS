'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const TABS    = { IN: 'inbound', OUT: 'outbound' }
const PAGE_SZ = 50

export default function LogsPage() {
  const [tab, setTab] = useState(TABS.IN)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">입출고 이력 조회</h1>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-white/10">
        {[
          { key: TABS.IN,  label: '📥 입고 이력' },
          { key: TABS.OUT, label: '🚛 출고 이력' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-white/[0.06] text-white border border-b-0 border-white/15'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === TABS.IN ? <InboundLogs /> : <OutboundLogs />}
    </div>
  )
}


// ════════════════════════════════════════
// 입고 이력
// ════════════════════════════════════════
function InboundLogs() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom())
  const [dateTo,   setDateTo]   = useState(todayStr())
  const [keyword,  setKeyword]  = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    setDbError('')
    const { data, error } = await supabase
      .from('inbound_logs')
      .select(`
        id, tier, side, created_at, operator, note,
        pallets (
          id, code,
          pallet_items (
            qty,
            products ( name, unit )
          )
        ),
        locations ( code )
      `)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SZ)

    if (error) setDbError(`DB 오류: ${error.message}`)
    setRows(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetch() }, [fetch])

  const filtered = rows.filter((r) => {
    if (!keyword) return true
    const kw = keyword.toLowerCase()
    return (
      r.pallets?.code?.toLowerCase().includes(kw) ||
      r.locations?.code?.toLowerCase().includes(kw) ||
      r.pallets?.pallet_items?.some((i) => i.products?.name?.includes(keyword))
    )
  })

  return (
    <LogShell
      loading={loading}
      count={filtered.length}
      dateFrom={dateFrom} setDateFrom={setDateFrom}
      dateTo={dateTo}     setDateTo={setDateTo}
      keyword={keyword}   setKeyword={setKeyword}
      onRefresh={fetch}
      dbError={dbError}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">입고 일시</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">파렛트 코드</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">로케이션</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500 text-center">슬롯</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">적재 상품</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {filtered.map((r) => {
            const items = r.pallets?.pallet_items ?? []
            return (
              <tr key={r.id} className="hover:bg-white/[0.025] transition-colors align-top">
                <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                  {fmtDt(r.created_at)}
                </td>
                <td className="py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                  {r.pallets?.code ?? '—'}
                </td>
                <td className="py-3 font-bold text-white whitespace-nowrap">
                  {r.locations?.code ?? '—'}
                </td>
                <td className="py-3 text-center">
                  <SlotChip tier={r.tier} side={r.side} />
                </td>
                <td className="py-3">
                  {items.length === 0 ? (
                    <span className="text-gray-600 text-xs">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {items.map((it, i) => (
                        <li key={i} className="text-xs text-gray-300 flex gap-2">
                          <span className="truncate">{it.products?.name}</span>
                          <span className="text-gray-500 shrink-0">
                            {it.qty} {it.products?.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {items.length > 1 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 border
                                     border-amber-500/30 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      혼적 {items.length}종
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </LogShell>
  )
}


// ════════════════════════════════════════
// 출고 이력
// ════════════════════════════════════════
function OutboundLogs() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom())
  const [dateTo,   setDateTo]   = useState(todayStr())
  const [keyword,  setKeyword]  = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    setDbError('')
    const { data, error } = await supabase
      .from('outbound_logs')
      .select(`
        id, tier, side, created_at, operator, note,
        pallets (
          id, code, inbound_at,
          pallet_items (
            qty,
            products ( name, unit )
          )
        ),
        locations ( code )
      `)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SZ)

    if (error) setDbError(`DB 오류: ${error.message}`)
    setRows(data ?? [])
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { fetch() }, [fetch])

  const filtered = rows.filter((r) => {
    if (!keyword) return true
    const kw = keyword.toLowerCase()
    return (
      r.pallets?.code?.toLowerCase().includes(kw) ||
      r.locations?.code?.toLowerCase().includes(kw) ||
      r.pallets?.pallet_items?.some((i) => i.products?.name?.includes(keyword))
    )
  })

  // 기간 내 총 출고 파렛트 수 요약
  const totalPallets = filtered.length

  return (
    <LogShell
      loading={loading}
      count={filtered.length}
      dateFrom={dateFrom} setDateFrom={setDateFrom}
      dateTo={dateTo}     setDateTo={setDateTo}
      keyword={keyword}   setKeyword={setKeyword}
      onRefresh={fetch}
      dbError={dbError}
      summary={
        <span className="text-xs text-gray-500">
          기간 내 출고 파렛트 <strong className="text-white">{totalPallets}건</strong>
        </span>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">출고 일시</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">파렛트 코드</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">출고 로케이션</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500 text-center">슬롯</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">출고 상품</th>
            <th className="pb-2.5 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500 text-right">입고→출고</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {filtered.map((r) => {
            const items   = r.pallets?.pallet_items ?? []
            const daysIn  = r.pallets?.inbound_at
              ? Math.floor(
                  (new Date(r.created_at) - new Date(r.pallets.inbound_at)) / 86_400_000,
                )
              : null

            return (
              <tr key={r.id} className="hover:bg-white/[0.025] transition-colors align-top">
                <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                  {fmtDt(r.created_at)}
                </td>
                <td className="py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                  {r.pallets?.code ?? '—'}
                </td>
                <td className="py-3 font-bold text-white whitespace-nowrap">
                  {r.locations?.code ?? '—'}
                </td>
                <td className="py-3 text-center">
                  <SlotChip tier={r.tier} side={r.side} />
                </td>
                <td className="py-3">
                  {items.length === 0 ? (
                    <span className="text-gray-600 text-xs">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {items.map((it, i) => (
                        <li key={i} className="text-xs text-gray-300 flex gap-2">
                          <span className="truncate">{it.products?.name}</span>
                          <span className="text-gray-500 shrink-0">
                            {it.qty} {it.products?.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="py-3 text-right text-xs text-gray-500 whitespace-nowrap">
                  {daysIn !== null ? (
                    <span className={daysIn > 30 ? 'text-amber-400' : ''}>
                      {daysIn}일 보관
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </LogShell>
  )
}


// ════════════════════════════════════════
// 공통 쉘 (필터 + 테이블 래퍼)
// ════════════════════════════════════════
function LogShell({
  loading, count, children,
  dateFrom, setDateFrom,
  dateTo,   setDateTo,
  keyword,  setKeyword,
  onRefresh, summary, dbError,
}) {
  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="wms-card flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="wms-label">시작일</label>
          <input type="date" value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={dateCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="wms-label">종료일</label>
          <input type="date" value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={dateCls} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="wms-label">파렛트·로케이션·상품 검색</label>
          <input
            type="search" placeholder="검색어 입력..."
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            className={dateCls} />
        </div>
        <button onClick={onRefresh}
          className="wms-btn wms-btn-ghost self-end">
          ↻ 새로고침
        </button>
      </div>

      {/* 결과 테이블 */}
      <div className="wms-card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">
            {count}건 표시 {count >= 50 && <span className="text-amber-400">(최대 50건)</span>}
          </span>
          {summary}
        </div>

        {dbError ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-red-400 text-sm font-semibold">테이블 조회 실패</p>
            <p className="text-gray-500 text-xs">{dbError}</p>
            <p className="text-gray-600 text-xs mt-2">
              Supabase에서 schema.sql을 실행했는지 확인하세요.
            </p>
          </div>
        ) : loading ? (
          <p className="text-center text-slate-400 py-12 animate-pulse">불러오는 중...</p>
        ) : count === 0 ? (
          <p className="text-center text-slate-500 py-12">해당 기간에 이력이 없습니다.</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// ── 슬롯 칩
function SlotChip({ tier, side }) {
  if (!tier || !side) return <span className="text-gray-700 text-xs">—</span>
  return (
    <span className="text-[10px] font-mono px-2 py-1 rounded-lg"
      style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(148,163,184,1)'}}>
      {tier}단 {side === 'L' ? '좌' : '우'}
    </span>
  )
}

// ── 날짜 유틸
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function defaultDateFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
function fmtDt(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const dateCls = 'wms-input py-2.5'
