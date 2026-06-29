'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import JsBarcode from 'jsbarcode'

const SIDE_KO = { L: '좌', R: '우' }

const PERIOD_OPTIONS = [
  { label: '오늘', value: '1'  },
  { label: '7일',  value: '7'  },
  { label: '30일', value: '30' },
  { label: '90일', value: '90' },
]

// 오더 상태 메타
const STATUS_META = {
  registered:  { label: '등록',   cls: 'bg-blue-600/20  text-[#F59E0B]  border-blue-600/40'  },
  instructed:  { label: '지시',   cls: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40' },
  on_hold:     { label: '보류',   cls: 'bg-orange-600/20 text-orange-400 border-orange-600/40' },
  cancelled:   { label: '취소',   cls: 'bg-gray-600/20  text-gray-400  border-gray-600/40'   },
  completed:   { label: '완료',   cls: 'bg-green-600/20  text-green-400  border-green-600/40'  },
  in_progress: { label: '진행중', cls: 'bg-cyan-600/20  text-cyan-400  border-cyan-600/40'   },
}

// 상태별 가능한 액션
const ACTIONS_BY_STATUS = {
  registered:  ['hold', 'cancel', 'delete'],
  instructed:  ['start', 'rerequest', 'hold', 'cancel'],
  in_progress: ['hold', 'cancel'],
  on_hold:     ['start', 'rerequest', 'cancel', 'delete'],
  cancelled:   ['delete'],
}

const ACTION_META = {
  start:     { label: '작업시작', emoji: '▶',  btnCls: 'bg-green-700 hover:bg-green-600'  },
  rerequest: { label: '재요청',  emoji: '🔄', btnCls: 'bg-[#F59E0B]/80 hover:bg-[#F59E0B] text-black'    },
  hold:      { label: '보류',   emoji: '⏸',  btnCls: 'bg-orange-700 hover:bg-orange-600' },
  cancel:    { label: '취소',   emoji: '🚫',  btnCls: 'bg-gray-700 hover:bg-gray-600'    },
  delete:    { label: '삭제',   emoji: '🗑',  btnCls: 'bg-red-800 hover:bg-red-700'      },
}

export default function WorkOrdersPage() {
  const [tab, setTab] = useState('orders')

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">작업지시서</h1>

      <div className="flex gap-2 border-b border-white/10">
        {[
          { key: 'orders', label: '오더 관리' },
          { key: 'logs',   label: '작업 이력' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-white/[0.06] text-white border border-b-0 border-white/15'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'logs'   && <LogsTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════
// 오더 관리 탭
// ══════════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')  // active | all
  const [actionTarget, setActionTarget] = useState(null)      // { order, action }
  const [printTarget, setPrintTarget]   = useState(null)      // order

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase.from('inbound_orders')
        .select(`id, order_no, status, status_reason, client_name,
                 scheduled_date, pallet_count, note, created_at, instructed_at,
                 inbound_order_items ( qty_per_pallet, products ( name, unit ) )`)
        .order('created_at', { ascending: false }),
      supabase.from('outbound_orders')
        .select(`id, order_no, status, status_reason, client_name,
                 scheduled_date, note, created_at, instructed_at,
                 outbound_order_items ( required_qty, products ( name, unit ) )`)
        .order('created_at', { ascending: false }),
    ])

    const toRow = (o, type) => ({
      ...o, type,
      items: type === 'inbound'
        ? (o.inbound_order_items  ?? []).map(it => ({ name: it.products?.name, unit: it.products?.unit, qty: it.qty_per_pallet }))
        : (o.outbound_order_items ?? []).map(it => ({ name: it.products?.name, unit: it.products?.unit, qty: it.required_qty  })),
    })

    const merged = [
      ...(inbound  ?? []).map(o => toRow(o, 'inbound')),
      ...(outbound ?? []).map(o => toRow(o, 'outbound')),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    setOrders(merged)
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function applyAction(order, action, reason) {
    const table = order.type === 'inbound' ? 'inbound_orders' : 'outbound_orders'

    if (action === 'delete') {
      // instructed 상태면 먼저 파렛트/피킹 레코드 정리
      if (order.type === 'inbound' && order.status === 'instructed') {
        await supabase.from('pallets').delete().eq('inbound_order_id', order.id)
      }
      if (order.type === 'outbound' && order.status === 'instructed') {
        await supabase.from('outbound_order_pallets').delete().eq('order_id', order.id)
      }
      await supabase.from(table).delete().eq('id', order.id)
    } else {
      let newStatus = order.status
      if (action === 'start')     newStatus = 'in_progress'
      if (action === 'hold')      newStatus = 'on_hold'
      if (action === 'cancel')    newStatus = 'cancelled'
      if (action === 'rerequest') {
        newStatus = 'registered'
        // 재요청 시 이전 지시 데이터 초기화
        if (order.type === 'inbound') {
          await supabase.from('pallets').delete().eq('inbound_order_id', order.id).eq('status', 'pending')
        }
        if (order.type === 'outbound') {
          await supabase.from('outbound_order_pallets').delete().eq('order_id', order.id)
        }
      }

      await supabase.from(table)
        .update({ status: newStatus, status_reason: reason || null })
        .eq('id', order.id)
    }
    setActionTarget(null)
    fetchOrders()
  }

  const ACTIVE_STATUSES = ['registered', 'instructed', 'in_progress', 'on_hold']

  const filtered = orders.filter(o => {
    if (typeFilter === 'inbound'  && o.type !== 'inbound')  return false
    if (typeFilter === 'outbound' && o.type !== 'outbound') return false
    if (statusFilter === 'active' && !ACTIVE_STATUSES.includes(o.status)) return false
    return true
  })

  const counts = {
    registered:  orders.filter(o => o.status === 'registered').length,
    instructed:  orders.filter(o => o.status === 'instructed').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    on_hold:     orders.filter(o => o.status === 'on_hold').length,
    cancelled:   orders.filter(o => o.status === 'cancelled').length,
  }

  return (
    <div className="space-y-4">
      {/* 현황 요약 */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { key: 'registered',  label: '등록',   color: 'text-[#F59E0B]'   },
          { key: 'instructed',  label: '지시',   color: 'text-yellow-400' },
          { key: 'in_progress', label: '진행중', color: 'text-cyan-400'   },
          { key: 'on_hold',     label: '보류',   color: 'text-orange-400' },
          { key: 'cancelled',   label: '취소',   color: 'text-gray-400'   },
        ].map(({ key, label, color }) => (
          <div key={key} className="wms-card text-center py-3">
            <p className={`text-2xl font-black ${color}`}>{counts[key]}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="wms-card flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {[
            { val: 'all',      label: '전체' },
            { val: 'inbound',  label: '입고' },
            { val: 'outbound', label: '출고' },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                typeFilter === val ? 'bg-[#F59E0B] text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {[
            { val: 'active', label: '진행중' },
            { val: 'all',    label: '전체 이력' },
          ].map(({ val, label }) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === val ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 오더 목록 */}
      {loading ? (
        <p className="text-center text-slate-400 py-12 animate-pulse">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-500 py-12">해당 조건의 오더가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const st = STATUS_META[order.status] ?? STATUS_META.registered
            const actions = ACTIONS_BY_STATUS[order.status] ?? []
            return (
              <div key={`${order.type}-${order.id}`} className="wms-card">
                <div className="flex items-start gap-3">
                  {/* 유형 뱃지 */}
                  <div className="shrink-0 pt-0.5">
                    {order.type === 'inbound' ? (
                      <span className="whitespace-nowrap text-xs font-bold px-2 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-800">입고</span>
                    ) : (
                      <span className="whitespace-nowrap text-xs font-bold px-2 py-1 rounded-full bg-red-900/40 text-red-400 border border-red-800">출고</span>
                    )}
                  </div>

                  {/* 오더 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#F59E0B] text-sm">{order.order_no}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                      {order.client_name && (
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{order.client_name}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {order.items.map((it, i) => (
                        <span key={i} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                          {it.name} × {it.qty}{it.unit}
                        </span>
                      ))}
                      {order.type === 'inbound' && order.pallet_count && (
                        <span className="text-xs text-yellow-500 bg-yellow-900/20 border border-yellow-800/40 px-2 py-0.5 rounded">
                          파렛트 {order.pallet_count}개
                        </span>
                      )}
                    </div>

                    {/* 사유 표시 */}
                    {order.status_reason && (
                      <p className="text-xs text-orange-400 bg-orange-900/20 border border-orange-800/30 px-3 py-1.5 rounded-lg mt-2">
                        💬 {order.status_reason}
                      </p>
                    )}

                    <p className="text-xs text-gray-600 mt-1.5">
                      등록: {new Date(order.created_at).toLocaleString('ko-KR')}
                      {order.scheduled_date && ` · 예정: ${order.scheduled_date}`}
                    </p>
                  </div>

                  {/* 액션 버튼 + 출력 */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {actions.map(action => {
                      const meta = ACTION_META[action]
                      return (
                        <button key={action}
                          onClick={() => setActionTarget({ order, action })}
                          className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors ${meta.btnCls}`}>
                          {meta.emoji} {meta.label}
                        </button>
                      )
                    })}
                    {actions.length > 0 && <div className="h-px bg-gray-700 my-0.5" />}
                    <button onClick={() => setPrintTarget(order)}
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors bg-gray-700 hover:bg-gray-500">
                      🖨️ 출력
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 액션 사유 모달 */}
      {actionTarget && (
        <ActionModal
          order={actionTarget.order}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
          onConfirm={(reason) => applyAction(actionTarget.order, actionTarget.action, reason)}
        />
      )}

      {printTarget && (
        <OrderPrintModal order={printTarget} onClose={() => setPrintTarget(null)} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
// 액션 사유 입력 모달
// ══════════════════════════════════════════════════
function ActionModal({ order, action, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const meta = ACTION_META[action]

  const PRESET_REASONS = {
    start:     [],
    rerequest: ['로케이션 재배정 필요', '상품 구성 변경', '일정 재조정', '작업자 요청'],
    hold:      ['작업자 부족', '창고 공간 부족', '화주사 요청', '상품 검수 필요', '장비 점검 중'],
    cancel:    ['화주사 오더 취소', '상품 미도착', '수량 불일치', '계약 변경'],
    delete:    ['테스트 데이터', '중복 등록', '오입력'],
  }

  const presets = PRESET_REASONS[action] ?? []
  const isDelete  = action === 'delete'
  const isStart   = action === 'start'
  const requireReason = !isDelete && !isStart

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleConfirm() {
    setLoading(true)
    await onConfirm(reason)
    setLoading(false)
  }

  const typeLabel = order.type === 'inbound' ? '입고' : '출고'

  // 위험 레벨별 색상
  const dangerCls = isDelete
    ? 'bg-red-700 hover:bg-red-600'
    : isStart
    ? 'bg-green-700 hover:bg-green-600'
    : action === 'cancel'
    ? 'bg-gray-700 hover:bg-gray-600'
    : action === 'hold'
    ? 'bg-orange-700 hover:bg-orange-600'
    : 'bg-[#F59E0B]/80 hover:bg-[#F59E0B] text-black'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md shadow-2xl"
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 py-5" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.emoji}</span>
            <div>
              <h2 className="text-white font-bold text-lg">{meta.label} 처리</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {typeLabel} 오더 · <span className="font-mono text-[#F59E0B]">{order.order_no}</span>
              </p>
            </div>
          </div>

          {/* 오더 요약 */}
          <div className="mt-3 rounded-xl px-4 py-3 text-xs space-y-1"
            style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <div className="flex gap-2">
              <span className="text-gray-500 w-12">상태</span>
              <span className="text-white">{STATUS_META[order.status]?.label ?? order.status}</span>
            </div>
            {order.client_name && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-12">화주사</span>
                <span className="text-white">{order.client_name}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 w-12">상품</span>
              <span className="text-gray-300 truncate">
                {order.items.map(it => `${it.name} ${it.qty}${it.unit}`).join(', ')}
              </span>
            </div>
          </div>

          {/* 재요청 / 삭제 경고 */}
          {action === 'rerequest' && order.status === 'instructed' && (
            <p className="mt-3 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-3 py-2">
              ⚠️ 입고지시 시 배정된 파렛트/슬롯이 초기화되고 다시 등록 상태로 돌아갑니다.
            </p>
          )}
          {isDelete && (
            <p className="mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              ⚠️ 삭제된 오더는 복구할 수 없습니다.
            </p>
          )}
          {isStart && (
            <p className="mt-3 text-xs text-green-400 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
              ▶ 작업을 시작하면 오더 상태가 <strong>진행중</strong>으로 변경됩니다.
            </p>
          )}
        </div>

        {/* 사유 입력 — 작업시작/삭제 제외 */}
        {!isStart && (
          <div className="px-6 py-5 space-y-3">
            <label className="text-xs font-medium text-gray-400">사유 <span className="text-gray-600">(선택)</span></label>

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {presets.map(p => (
                  <button key={p} type="button"
                    onClick={() => setReason(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      reason === p
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            {!isDelete && (
              <textarea
                ref={inputRef}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="직접 사유를 입력하거나 위에서 선택하세요..."
                rows={3}
                className="wms-input resize-none" />
            )}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 wms-btn wms-btn-ghost">취소</button>
          <button onClick={handleConfirm} disabled={loading}
            className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-40 ${dangerCls}`}>
            {loading ? '처리 중...' : `${meta.emoji} ${meta.label} 확인`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// 작업 이력 탭 (기존 로그 조회)
// ══════════════════════════════════════════════════
function LogsTab() {
  const [logs, setLogs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('all')
  const [periodFilter, setPeriodFilter] = useState('7')
  const [selected, setSelected]       = useState(null)

  async function fetchLogs(period) {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - Number(period))
    const sinceISO = since.toISOString()

    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase.from('inbound_logs')
        .select(`id, created_at, operator, tier, side,
                 pallets ( code, pallet_items ( qty, products ( code, name, unit ) ) ),
                 locations ( code, zones ( code, name ) )`)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false }),
      supabase.from('outbound_logs')
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

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="wms-card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {[
              { val: 'all',      label: '전체' },
              { val: 'inbound',  label: '입고' },
              { val: 'outbound', label: '출고' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setTypeFilter(val)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  typeFilter === val ? 'bg-[#F59E0B] text-black' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
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
                  periodFilter === value ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'
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
            className="wms-input pl-10" />
        </div>
        {!loading && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>총 <span className="text-white font-semibold">{filtered.length}</span>건</span>
            <span className="text-green-400">입고 {filtered.filter(l => l.type === 'inbound').length}건</span>
            <span className="text-red-400">출고 {filtered.filter(l => l.type === 'outbound').length}건</span>
            <span className="ml-auto text-gray-600">행 클릭 → 상세 조회 및 출력</span>
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="wms-card p-0 overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 py-12 animate-pulse">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12">해당 조건의 작업 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.02)'}}>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500 w-28">유형</th>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">로케이션</th>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">슬롯</th>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">파렛트</th>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">상품 / 수량</th>
                  <th className="px-5 py-3 text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500 text-right">작업일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map(log => (
                  <tr key={log.uid} onClick={() => setSelected(log)}
                    className="cursor-pointer transition-colors hover:bg-[#F59E0B]/10">
                    <td className="px-5 py-4">
                      {log.type === 'inbound' ? (
                        <span className="whitespace-nowrap inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-800">입고</span>
                      ) : (
                        <span className="whitespace-nowrap inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-900/40 text-red-400 border border-red-800">출고</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-block bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] font-mono font-bold text-xs px-3 py-1 rounded-lg">
                        {log.locationCode}
                      </span>
                      {log.zoneCode && <span className="text-xs text-gray-600 ml-2">{log.zoneCode}구역</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-gray-300 font-mono bg-gray-800 px-2 py-1 rounded-lg">
                        {log.tier}단 {SIDE_KO[log.side] ?? log.side}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{log.palletCode}</td>
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
                          {log.products.length > 2 && <span className="text-xs text-[#F59E0B]">+{log.products.length - 2}개 (혼적)</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-gray-500 whitespace-nowrap">
                      <div className="text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </div>
                      <div>{new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <WorkOrderDetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ══════════════════════════════════════════════════
// 작업지시서 상세 팝업 + 출력
// ══════════════════════════════════════════════════
function WorkOrderDetailModal({ log, onClose }) {
  const barcodeRef   = useRef(null)
  const printAreaRef = useRef(null)

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
    if (!printAreaRef.current) return
    const printDiv = document.createElement('div')
    printDiv.id = 'wms-order-print'
    printDiv.appendChild(printAreaRef.current.cloneNode(true))
    document.body.appendChild(printDiv)
    document.body.classList.add('printing-order')
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-order')
      if (document.body.contains(printDiv)) document.body.removeChild(printDiv)
    }, { once: true })
    window.print()
  }

  const dt         = new Date(log.createdAt)
  const typeLabel  = log.type === 'inbound' ? '입고' : '출고'
  const typeEmoji  = log.type === 'inbound' ? '📥' : '🚛'
  const totalQty   = log.products.reduce((s, p) => s + p.qty, 0)

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} onClick={onClose}>
      <div className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        <div className="no-print px-5 py-4 flex items-center justify-between shrink-0"
          style={{background:'rgba(15,20,40,0.98)',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeEmoji}</span>
            <span className="text-white font-bold">{typeLabel} 작업지시서</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="wms-btn wms-btn-primary">🖨️ 출력</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none ml-2">✕</button>
          </div>
        </div>

        <div ref={printAreaRef} className="label-print-area overflow-y-auto bg-white text-black flex-1">
          <div className="px-6 pt-6 pb-4 border-b-2 border-black">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase">Palette Rack WMS</p>
                <h1 className="text-2xl font-black tracking-tight mt-0.5">{typeEmoji} {typeLabel} 작업지시서</h1>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <p className="font-bold text-gray-800 text-sm">
                  {dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
                <p>{dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-200">
            <InfoCell label="구역" value={log.zoneCode ? `${log.zoneCode} ${log.zoneName}`.trim() : '—'} />
            <InfoCell label="로케이션" value={log.locationCode} large />
            <InfoCell label="슬롯"
              value={log.tier && log.side ? `${log.tier}단 ${SIDE_KO[log.side] ?? log.side}(${log.side})` : '—'} />
          </div>

          <div className="px-6 py-4 border-b border-gray-200 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-2">Pallet Code</p>
            {log.palletCode && log.palletCode !== '—'
              ? <svg ref={barcodeRef} className="max-w-full" />
              : <p className="text-gray-400 text-sm">바코드 없음</p>}
          </div>

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
                  <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400 text-xs">상품 정보 없음</td></tr>
                ) : log.products.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.code}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{p.name}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{p.qty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{p.unit}</td>
                  </tr>
                ))}
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

          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-3 gap-3 mt-2">
              {['담당자', '확인자', '입회자'].map(role => (
                <div key={role} className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-semibold text-gray-500 text-center">{role}</div>
                  <div className="h-14" />
                  <div className="border-t border-gray-200 px-3 py-1 text-[10px] text-gray-400 text-center">(서명)</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              발행일시: {dt.toLocaleString('ko-KR')} · Palette Rack WMS
            </p>
          </div>
        </div>

        <div className="no-print px-5 py-3 flex justify-end gap-2 shrink-0"
          style={{background:'rgba(15,20,40,0.98)',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <button onClick={handlePrint} className="wms-btn wms-btn-primary">🖨️ 인쇄</button>
          <button onClick={onClose} className="wms-btn wms-btn-ghost">닫기</button>
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

// ══════════════════════════════════════════════════
// 오더 작업지시서 출력 모달
// ══════════════════════════════════════════════════
function OrderPrintModal({ order, onClose }) {
  const barcodeRef   = useRef(null)
  const printAreaRef = useRef(null)
  const typeLabel  = order.type === 'inbound' ? '입고' : '출고'
  const typeEmoji  = order.type === 'inbound' ? '📥' : '🚛'
  const st         = STATUS_META[order.status] ?? STATUS_META.registered
  const now        = new Date()
  const totalQty   = order.items.reduce((s, it) => s + (it.qty ?? 0), 0)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!barcodeRef.current) return
    try {
      JsBarcode(barcodeRef.current, order.order_no, {
        format: 'CODE128', width: 2, height: 60,
        displayValue: true, fontSize: 13, margin: 8,
        background: '#ffffff', lineColor: '#000000',
      })
    } catch {}
  }, [order.order_no])

  function handlePrint() {
    if (!printAreaRef.current) return
    const printDiv = document.createElement('div')
    printDiv.id = 'wms-order-print'
    printDiv.appendChild(printAreaRef.current.cloneNode(true))
    document.body.appendChild(printDiv)
    document.body.classList.add('printing-order')
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-order')
      if (document.body.contains(printDiv)) document.body.removeChild(printDiv)
    }, { once: true })
    window.print()
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }} onClick={onClose}>
      <div className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* 모달 헤더 */}
        <div className="no-print px-5 py-4 flex items-center justify-between shrink-0"
          style={{background:'rgba(15,20,40,0.98)',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeEmoji}</span>
            <span className="text-white font-bold">{typeLabel} 작업지시서 출력</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="wms-btn wms-btn-primary">🖨️ 출력</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none ml-2">✕</button>
          </div>
        </div>

        {/* 인쇄 영역 */}
        <div ref={printAreaRef} className="label-print-area overflow-y-auto bg-white text-black flex-1">

          {/* 상단 헤더 */}
          <div className="px-6 pt-6 pb-4 border-b-2 border-black">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase">Palette Rack WMS</p>
                <h1 className="text-2xl font-black tracking-tight mt-0.5">{typeEmoji} {typeLabel} 작업지시서</h1>
              </div>
              <div className="text-right text-xs text-gray-500 space-y-0.5">
                <p className="font-bold text-gray-800 text-sm">
                  {now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
                <p>{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 발행</p>
                <p className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100">
                  {st.label}
                </p>
              </div>
            </div>
          </div>

          {/* 바코드 */}
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col items-center">
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-2">Order No.</p>
            <svg ref={barcodeRef} className="max-w-full" />
          </div>

          {/* 기본 정보 */}
          <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-200">
            <div>
              <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">화주사</p>
              <p className="font-bold text-gray-900 text-sm">{order.client_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">예정일</p>
              <p className="font-bold text-gray-900 text-sm">{order.scheduled_date || '—'}</p>
            </div>
            {order.type === 'inbound' && (
              <div>
                <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">파렛트 수</p>
                <p className="font-bold text-gray-900 text-sm">{order.pallet_count ? `${order.pallet_count}개` : '—'}</p>
              </div>
            )}
          </div>

          {/* 상품 내역 */}
          <div className="px-6 py-4">
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-3">상품 내역</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100 text-xs text-gray-600">
                  <th className="px-3 py-2 text-left font-semibold">상품명</th>
                  <th className="px-3 py-2 text-right font-semibold">수량</th>
                  <th className="px-3 py-2 text-right font-semibold">단위</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-400 text-xs">상품 정보 없음</td></tr>
                ) : order.items.map((it, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{it.name}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{(it.qty ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{it.unit}</td>
                  </tr>
                ))}
              </tbody>
              {order.items.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-sm border-t border-gray-200">
                    <td className="px-3 py-2 text-right text-gray-600">합계</td>
                    <td className="px-3 py-2 text-right text-gray-900">{totalQty.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* 비고 */}
          {order.note && (
            <div className="px-6 pb-4">
              <p className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">비고</p>
              <p className="text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2">{order.note}</p>
            </div>
          )}

          {/* 서명란 */}
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-3 gap-3 mt-2">
              {['담당자', '확인자', '입회자'].map(role => (
                <div key={role} className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-1.5 text-[10px] font-semibold text-gray-500 text-center">{role}</div>
                  <div className="h-14" />
                  <div className="border-t border-gray-200 px-3 py-1 text-[10px] text-gray-400 text-center">(서명)</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              등록: {new Date(order.created_at).toLocaleString('ko-KR')} · Palette Rack WMS
            </p>
          </div>
        </div>

        {/* 모달 하단 */}
        <div className="no-print px-5 py-3 flex justify-end gap-2 shrink-0"
          style={{background:'rgba(15,20,40,0.98)',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <button onClick={handlePrint} className="wms-btn wms-btn-primary">🖨️ 인쇄</button>
          <button onClick={onClose} className="wms-btn wms-btn-ghost">닫기</button>
        </div>
      </div>
    </div>
  )
}
