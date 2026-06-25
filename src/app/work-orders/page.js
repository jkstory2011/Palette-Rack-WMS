'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import JsBarcode from 'jsbarcode'

const SIDE_KO = { L: '좌', R: '우' }

const PERIOD_OPTIONS = [
  { label: '오늘', value: '1'  },
  { label: '7일',  value: '7'  },
  { label: '30일', value: '30' },
  { label: '90일', value: '90' },
]

export default function WorkOrdersPage() {
  const [logs, setLogs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [periodFilter, setPeriodFilter] = useState('7')
  const [selected, setSelected]       = useState(null)  // 팝업에 표시할 로그

  async function fetchLogs(period) {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - Number(period))
    const sinceISO = since.toISOString()

    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase
        .from('inbound_logs')
        .select(`id, created_at, operator, tier, side,
                 pallets ( code, pallet_items ( qty, products ( code, name, unit ) ) ),
                 locations ( code, zones ( code, name ) )`)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),

      supabase
        .from('outbound_logs')
        .select(`id, created_at, operator, tier, side,
                 pallets ( code, pallet_items ( qty, products ( code, name, unit ) ) ),
                 locations ( code, zones ( code, name ) )`)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),
    ])

    const toRow = (log, type) => ({
      uid:          `${type}-${log.id}`,
      type,
      createdAt:    log.created_at,
      operator:     log.operator ?? '',
      tier:         log.tier,
      side:         log.side,
      palletCode:   log.pallets?.code ?? '—',
      locationCode: log.locations?.code ?? '—',
      zoneCode:     log.locations?.zones?.code ?? '',
      zoneName:     log.locations?.zones?.name ?? '',
      products:     (log.pallets?.pallet_items ?? []).map(it => ({
        code: it.products?.code ?? '—',
        name: it.products?.name ?? '—',
        unit: it.products?.unit ?? '',
        qty:  it.qty ?? 0,
      })),
    })

    const merged = [
      ...(inbound  ?? []).map(r => toRow(r, 'inbound')),
      ...(outbound ?? []).map(r => toRow(r, 'outbound')),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    setLogs(merged)
    setLoading(false)
  }

  useEffect(() => { fetchLogs(periodFilter) }, [periodFilter])

  const filtered = logs.filter(log => {
    if (typeFilter === 'inbound'  && log.type !== 'inbound')  return false
    if (typeFilter === 'outbound' && log.type !== 'outbound') return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      log.locationCode.toLowerCase().includes(q) ||
      log.palletCode.toLowerCase().includes(q) ||
      log.products.some(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    )
  })

  const inboundCount  = filtered.filter(l => l.type === 'inbound').length
  const outboundCount = filtered.filter(l => l.type === 'outbound').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">작업지시서</h1>

      {/* ── 필터 */}
      <div className="wms-card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {[
              { val: 'all',      label: '전체' },
              { val: 'inbound',  label: '📥 입고' },
              { val: 'outbound', label: '🚛 출고' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setTypeFilter(val)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  typeFilter === val
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-1.5">
            {PERIOD_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => setPeriodFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  periodFilter === value
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input type="search" placeholder="로케이션, 파렛트 코드, 상품명 검색..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-10 pr-4 py-3
                       text-white text-sm placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
        </div>

        {!loading && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>총 <span className="text-white font-semibold">{filtered.length}</span>건</span>
            <span className="text-green-400">입고 {inboundCount}건</span>
            <span className="text-red-400">출고 {outboundCount}건</span>
            <span className="ml-auto text-gray-600">행을 클릭하면 상세 조회 및 출력 가능</span>
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
                {filtered.map(log => (
                  <tr key={log.uid}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer transition-colors hover:bg-blue-600/10 hover:border-l-2 hover:border-blue-500">
                    {/* 유형 */}
                    <td className="px-5 py-4">
                      {log.type === 'inbound' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
                                         bg-green-900/40 text-green-400 border border-green-800">📥 입고</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
                                         bg-red-900/40 text-red-400 border border-red-800">🚛 출고</span>
                      )}
                    </td>
                    {/* 로케이션 */}
                    <td className="px-5 py-4">
                      <span className="inline-block bg-blue-600/20 border border-blue-500/30
                                       text-blue-300 font-mono font-bold text-xs px-3 py-1 rounded-lg">
                        {log.locationCode}
                      </span>
                      {log.zoneCode && <span className="text-xs text-gray-600 ml-2">{log.zoneCode}구역</span>}
                    </td>
                    {/* 슬롯 */}
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-300 font-mono bg-gray-800 px-2 py-1 rounded-lg">
                        {log.tier}단 {SIDE_KO[log.side] ?? log.side}
                      </span>
                    </td>
                    {/* 파렛트 */}
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{log.palletCode}</td>
                    {/* 상품 */}
                    <td className="px-5 py-4">
                      {log.products.length === 0 ? (
                        <span className="text-gray-600 text-xs">정보 없음</span>
                      ) : (
                        <div className="space-y-0.5">
                          {log.products.slice(0, 2).map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-white text-xs font-medium">{p.name}</span>
                              <span className="text-gray-500 text-xs">{p.qty.toLocaleString()} {p.unit}</span>
                            </div>
                          ))}
                          {log.products.length > 2 && (
                            <span className="text-xs text-blue-400">+{log.products.length - 2}개 (혼적)</span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* 일시 */}
                    <td className="px-5 py-4 text-right text-xs text-gray-500 whitespace-nowrap">
                      <div className="text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </div>
                      <div>
                        {new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 상세 팝업 */}
      {selected && (
        <WorkOrderDetailModal log={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
// 작업지시서 상세 팝업 + 출력
// ══════════════════════════════════════════════════
function WorkOrderDetailModal({ log, onClose }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!barcodeRef.current || !log.palletCode || log.palletCode === '—') return
    try {
      JsBarcode(barcodeRef.current, log.palletCode, {
        format: 'CODE128', width: 1.8, height: 56,
        displayValue: true, fontSize: 12, margin: 6,
        background: '#ffffff', lineColor: '#000000',
      })
    } catch {}
  }, [log.palletCode])

  function handlePrint() {
    document.body.classList.add('printing-label')
    window.print()
    document.body.classList.remove('printing-label')
  }

  const dt = new Date(log.createdAt)
  const typeLabel  = log.type === 'inbound' ? '입고' : '출고'
  const typeEmoji  = log.type === 'inbound' ? '📥' : '🚛'
  const totalQty   = log.products.reduce((s, p) => s + p.qty, 0)

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} onClick={onClose}>
      <div className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* 모달 헤더 — 화면에서만 보임 */}
        <div className="no-print bg-gray-900 border-b border-gray-700 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeEmoji}</span>
            <span className="text-white font-bold">{typeLabel} 작업지시서</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white text-sm font-bold transition-colors">
              🖨️ 출력
            </button>
            <button onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none ml-2">✕</button>
          </div>
        </div>

        {/* 출력 영역 */}
        <div className="label-print-area overflow-y-auto bg-white text-black flex-1">
          {/* 문서 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b-2 border-black">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase">Palette Rack WMS</p>
                <h1 className="text-2xl font-black tracking-tight mt-0.5">
                  {typeEmoji} {typeLabel} 작업지시서
                </h1>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <p className="font-bold text-gray-800 text-sm">
                  {dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
                <p>{dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

          {/* 로케이션 정보 */}
          <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-200">
            <InfoCell label="구역" value={log.zoneCode ? `${log.zoneCode} ${log.zoneName}`.trim() : '—'} />
            <InfoCell label="로케이션" value={log.locationCode} large />
            <InfoCell label="슬롯"
              value={log.tier && log.side ? `${log.tier}단 ${SIDE_KO[log.side] ?? log.side}(${log.side})` : '—'} />
          </div>

          {/* 바코드 */}
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-2">Pallet Code</p>
            {log.palletCode && log.palletCode !== '—' ? (
              <svg ref={barcodeRef} className="max-w-full" />
            ) : (
              <p className="text-gray-400 text-sm">바코드 없음</p>
            )}
          </div>

          {/* 상품 목록 */}
          <div className="px-6 py-4">
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-3">상품 내역</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100 text-xs text-gray-600">
                  <th className="px-3 py-2 text-left font-semibold">상품코드</th>
                  <th className="px-3 py-2 text-left font-semibold">상품명</th>
                  <th className="px-3 py-2 text-right font-semibold">수량</th>
                  <th className="px-3 py-2 text-right font-semibold">단위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-gray-400 text-xs">상품 정보 없음</td>
                  </tr>
                ) : (
                  log.products.map((p, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.code}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">{p.name}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">{p.qty.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{p.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {log.products.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-sm border-t border-gray-200">
                    <td colSpan={2} className="px-3 py-2 text-right text-gray-600">합계</td>
                    <td className="px-3 py-2 text-right text-gray-900">{totalQty.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 서명란 */}
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-3 gap-3 mt-2">
              {['담당자', '확인자', '입회자'].map(role => (
                <div key={role} className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-semibold text-gray-500 text-center">
                    {role}
                  </div>
                  <div className="h-14" />
                  <div className="border-t border-gray-200 px-3 py-1 text-[10px] text-gray-400 text-center">
                    (서명)
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              발행일시: {dt.toLocaleString('ko-KR')} · Palette Rack WMS
            </p>
          </div>
        </div>

        {/* 하단 버튼 — 화면에서만 보임 */}
        <div className="no-print bg-gray-900 border-t border-gray-700 px-5 py-3 flex justify-end gap-2 shrink-0">
          <button onClick={handlePrint}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors">
            🖨️ 인쇄
          </button>
          <button onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value, large }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">{label}</p>
      <p className={`font-bold text-gray-900 ${large ? 'text-xl' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
