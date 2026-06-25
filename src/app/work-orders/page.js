'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SIDE_KO = { L: '좌', R: '우' }

const PERIOD_OPTIONS = [
  { label: '오늘',  value: '1'  },
  { label: '7일',   value: '7'  },
  { label: '30일',  value: '30' },
  { label: '90일',  value: '90' },
]

export default function WorkOrdersPage() {
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter]     = useState('all')   // all | inbound | outbound
  const [periodFilter, setPeriodFilter] = useState('7')
  const [expanded, setExpanded]   = useState({})            // { logId: bool }

  async function fetchLogs(period) {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - Number(period))
    const sinceISO = since.toISOString()

    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase
        .from('inbound_logs')
        .select(`
          id, created_at, operator, tier, side,
          pallets ( code,
            pallet_items ( qty, products ( code, name, unit ) )
          ),
          locations ( code, zones ( code ) )
        `)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),

      supabase
        .from('outbound_logs')
        .select(`
          id, created_at, operator, tier, side,
          pallets ( code,
            pallet_items ( qty, products ( code, name, unit ) )
          ),
          locations ( code, zones ( code ) )
        `)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),
    ])

    const toRow = (log, type) => ({
      uid:          `${type}-${log.id}`,
      type,
      createdAt:    log.created_at,
      operator:     log.operator ?? '—',
      tier:         log.tier,
      side:         log.side,
      palletCode:   log.pallets?.code ?? '—',
      locationCode: log.locations?.code ?? '—',
      zoneCode:     log.locations?.zones?.code ?? '',
      products:     (log.pallets?.pallet_items ?? []).map((it) => ({
        code: it.products?.code ?? '—',
        name: it.products?.name ?? '—',
        unit: it.products?.unit ?? '',
        qty:  it.qty ?? 0,
      })),
    })

    const merged = [
      ...(inbound  ?? []).map((r) => toRow(r, 'inbound')),
      ...(outbound ?? []).map((r) => toRow(r, 'outbound')),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    setLogs(merged)
    setLoading(false)
  }

  useEffect(() => { fetchLogs(periodFilter) }, [periodFilter])

  // 검색 + 유형 필터
  const filtered = logs.filter((log) => {
    if (typeFilter === 'inbound'  && log.type !== 'inbound')  return false
    if (typeFilter === 'outbound' && log.type !== 'outbound') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      log.locationCode.toLowerCase().includes(q) ||
      log.palletCode.toLowerCase().includes(q) ||
      log.products.some(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      )
    )
  })

  const inboundCount  = filtered.filter((l) => l.type === 'inbound').length
  const outboundCount = filtered.filter((l) => l.type === 'outbound').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">작업지시서</h1>

      {/* ── 필터 카드 */}
      <div className="wms-card space-y-4">

        {/* 유형 탭 + 기간 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {[
              { val: 'all',      label: '전체' },
              { val: 'inbound',  label: '📥 입고' },
              { val: 'outbound', label: '🚛 출고' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  typeFilter === val
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* 기간 선택 */}
          <div className="flex gap-1.5">
            {PERIOD_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setPeriodFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  periodFilter === value
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            type="search"
            placeholder="로케이션, 파렛트 코드, 상품명 또는 상품코드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-10 pr-4 py-3
                       text-white text-sm placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>

        {/* 요약 카운트 */}
        {!loading && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>총 <span className="text-white font-semibold">{filtered.length}</span>건</span>
            <span className="text-green-400">입고 {inboundCount}건</span>
            <span className="text-red-400">출고 {outboundCount}건</span>
          </div>
        )}
      </div>

      {/* ── 목록 */}
      <div className="wms-card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-500 py-12 animate-pulse">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-12">해당 조건의 작업 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-700 bg-gray-900/60">
                  <th className="px-5 py-3 font-medium w-24">유형</th>
                  <th className="px-5 py-3 font-medium">로케이션</th>
                  <th className="px-5 py-3 font-medium">슬롯</th>
                  <th className="px-5 py-3 font-medium">파렛트</th>
                  <th className="px-5 py-3 font-medium">상품 / 수량</th>
                  <th className="px-5 py-3 font-medium text-right">작업일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {filtered.map((log) => {
                  const isExpanded = expanded[log.uid]
                  const hasMulti   = log.products.length > 1

                  return (
                    <tr
                      key={log.uid}
                      onClick={() => hasMulti && setExpanded((p) => ({ ...p, [log.uid]: !p[log.uid] }))}
                      className={`transition-colors ${
                        hasMulti ? 'cursor-pointer hover:bg-gray-800/50' : 'hover:bg-gray-800/30'
                      }`}
                    >
                      {/* 유형 */}
                      <td className="px-5 py-4">
                        {log.type === 'inbound' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold
                                           px-2.5 py-1 rounded-full
                                           bg-green-900/40 text-green-400 border border-green-800">
                            📥 입고
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold
                                           px-2.5 py-1 rounded-full
                                           bg-red-900/40 text-red-400 border border-red-800">
                            🚛 출고
                          </span>
                        )}
                      </td>

                      {/* 로케이션 */}
                      <td className="px-5 py-4">
                        <span className="inline-block bg-blue-600/20 border border-blue-500/30
                                         text-blue-300 font-mono font-bold text-xs
                                         px-3 py-1 rounded-lg">
                          {log.locationCode}
                        </span>
                        {log.zoneCode && (
                          <span className="text-xs text-gray-600 ml-2">{log.zoneCode}구역</span>
                        )}
                      </td>

                      {/* 슬롯 */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-300 font-mono bg-gray-800
                                         px-2 py-1 rounded-lg">
                          {log.tier}단 {SIDE_KO[log.side] ?? log.side}
                        </span>
                      </td>

                      {/* 파렛트 */}
                      <td className="px-5 py-4 font-mono text-xs text-gray-400">
                        {log.palletCode}
                      </td>

                      {/* 상품 */}
                      <td className="px-5 py-4">
                        {log.products.length === 0 ? (
                          <span className="text-gray-600 text-xs">정보 없음</span>
                        ) : (
                          <div className="space-y-1">
                            {(isExpanded ? log.products : log.products.slice(0, 1)).map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-white text-xs font-medium">{p.name}</span>
                                <span className="text-gray-500 text-xs font-mono">
                                  {p.qty.toLocaleString()} {p.unit}
                                </span>
                              </div>
                            ))}
                            {hasMulti && (
                              <span className="text-xs text-blue-400">
                                {isExpanded
                                  ? '▲ 접기'
                                  : `+${log.products.length - 1}개 더 (혼적) ▼`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 일시 */}
                      <td className="px-5 py-4 text-right text-xs text-gray-500 whitespace-nowrap">
                        <div className="text-gray-400">
                          {new Date(log.createdAt).toLocaleDateString('ko-KR', {
                            month: '2-digit', day: '2-digit',
                          })}
                        </div>
                        <div>
                          {new Date(log.createdAt).toLocaleTimeString('ko-KR', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
