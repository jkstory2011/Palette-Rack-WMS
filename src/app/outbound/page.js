'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getFifoLocations, pickFifoItems } from '@/lib/utils/fifo'
import { generateOrderNo } from '@/lib/utils/pallet'

const SIDE_KO = { L: '좌(L)', R: '우(R)' }

export default function OutboundPage() {
  const [tab, setTab] = useState('register')

  const TABS = [
    { key: 'register', label: '① 출고등록' },
    { key: 'instruct', label: '② 출고지시' },
    { key: 'complete', label: '③ 출고완료' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">출고 관리</h1>

      <div className="flex gap-2 border-b border-gray-700">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'register' && <RegisterTab onDone={() => setTab('instruct')} />}
      {tab === 'instruct' && <InstructTab onDone={() => setTab('complete')} />}
      {tab === 'complete' && <CompleteTab onDone={() => setTab('register')} />}
    </div>
  )
}

// ══════════════════════════════════════════════════
// ① 출고등록
// ══════════════════════════════════════════════════
function RegisterTab({ onDone }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    clientName: '', scheduledDate: '', note: '',
    items: [{ productId: '', requiredQty: '' }],
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    supabase.from('products').select('id, code, name, unit').order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  function updateItem(i, field, val) {
    setForm(f => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: val }
      return { ...f, items }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.items.some(it => !it.productId || !it.requiredQty || Number(it.requiredQty) <= 0))
      return setError('상품과 출고 수량을 입력하세요.')
    if (new Set(form.items.map(it => it.productId)).size < form.items.length)
      return setError('같은 상품이 중복되어 있습니다.')

    setSaving(true)
    try {
      const { data: existing } = await supabase.from('outbound_orders').select('order_no')
      const orderNo = generateOrderNo((existing ?? []).map(r => r.order_no), 'OUT')

      const { data: order, error: oErr } = await supabase
        .from('outbound_orders')
        .insert({
          order_no:       orderNo,
          client_name:    form.clientName || null,
          scheduled_date: form.scheduledDate || null,
          note:           form.note || null,
        })
        .select('id').single()
      if (oErr) throw oErr

      const itemRows = form.items.map(it => ({
        order_id:     order.id,
        product_id:   Number(it.productId),
        required_qty: Number(it.requiredQty),
      }))
      const { error: iErr } = await supabase.from('outbound_order_items').insert(itemRows)
      if (iErr) throw iErr

      setSuccess(`✅ 출고오더 ${orderNo} 등록 완료 — 출고지시 탭에서 피킹 목록을 생성하세요.`)
      setForm({ clientName: '', scheduledDate: '', note: '', items: [{ productId: '', requiredQty: '' }] })
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">기본 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="화주사명">
            <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="(주)OO물류" className={inputCls} />
          </Field>
          <Field label="예정 출고일">
            <input type="date" value={form.scheduledDate}
              onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="메모">
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="비고" className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">출고 상품</h2>
        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="">상품 선택...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min="1" placeholder="수량"
                  value={item.requiredQty} onChange={e => updateItem(i, 'requiredQty', e.target.value)}
                  className="w-24 bg-gray-800 border border-gray-600 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                <span className="text-gray-500 text-sm w-10">
                  {products.find(p => String(p.id) === String(item.productId))?.unit ?? ''}
                </span>
              </div>
              {form.items.length > 1 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                  className="text-gray-600 hover:text-red-400 text-lg transition-colors shrink-0">✕</button>
              )}
            </div>
          ))}
        </div>
        <button type="button"
          onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: '', requiredQty: '' }] }))}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          + 상품 추가
        </button>
      </div>

      {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold transition-colors disabled:opacity-40">
        {saving ? '등록 중...' : '📋 출고 등록'}
      </button>
    </form>
  )
}

// ══════════════════════════════════════════════════
// ② 출고지시
// ══════════════════════════════════════════════════
function InstructTab({ onDone }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [instructing, setInstructing] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('outbound_orders')
      .select(`id, order_no, status, client_name, scheduled_date, note, created_at,
               outbound_order_items ( required_qty, products ( name, unit ) )`)
      .eq('status', 'registered')
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  if (loading) return <p className="text-center text-gray-500 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-gray-600 py-12">대기 중인 출고오더가 없습니다.</p>

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="wms-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400 font-bold text-sm">{order.order_no}</span>
                {order.client_name && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{order.client_name}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(order.outbound_order_items ?? []).map((it, i) => (
                  <span key={i} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                    {it.products?.name} {it.required_qty}{it.products?.unit}
                  </span>
                ))}
              </div>
              {order.scheduled_date && <p className="text-xs text-gray-500 mt-1">예정일: {order.scheduled_date}</p>}
            </div>
            <button onClick={() => setInstructing(order)}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold transition-colors">
              지시 →
            </button>
          </div>
        </div>
      ))}

      {instructing && (
        <OutboundInstructModal
          order={instructing}
          onClose={() => setInstructing(null)}
          onComplete={() => { setInstructing(null); fetchOrders(); onDone() }}
        />
      )}
    </div>
  )
}

function OutboundInstructModal({ order, onClose, onComplete }) {
  const [pickList, setPickList]   = useState([])  // FIFO 피킹 목록
  const [loading, setLoading]     = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data: items } = await supabase
          .from('outbound_order_items')
          .select('product_id, required_qty, products(name, unit)')
          .eq('order_id', order.id)

        const all = []
        for (const item of items ?? []) {
          const fifo = await getFifoLocations(supabase, item.product_id)
          const result = pickFifoItems(fifo, item.required_qty)
          all.push({
            productId:   item.product_id,
            productName: item.products?.name ?? '',
            unit:        item.products?.unit ?? '',
            requiredQty: item.required_qty,
            fulfilled:   result.fulfilled,
            picks:       result.items,
          })
        }
        setPickList(all)
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    })()
  }, [order.id])

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      // outbound_order_pallets 저장
      const palletRows = []
      for (const entry of pickList) {
        for (const pick of entry.picks) {
          palletRows.push({
            order_id:          order.id,
            pallet_id:         pick.palletId,
            ship_qty:          pick.shipQty,
            is_partial:        pick.isPartial,
            location_snapshot: pick.locationCode,
            tier:              pick.tier,
            side:              pick.side,
          })
        }
      }
      if (palletRows.length === 0) throw new Error('피킹할 재고가 없습니다.')

      const { error: pErr } = await supabase.from('outbound_order_pallets').insert(palletRows)
      if (pErr) throw pErr

      const { error: oErr } = await supabase.from('outbound_orders')
        .update({ status: 'instructed', instructed_at: new Date().toISOString() })
        .eq('id', order.id)
      if (oErr) throw oErr

      setDone(true)
    } catch (err) {
      setError(err.message)
    }
    setConfirming(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">출고지시 — FIFO 피킹 목록</h2>
            <p className="text-sm text-gray-400">{order.order_no}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {done ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-3xl">✅</p>
              <p className="text-white font-bold text-lg">출고지시 완료</p>
              <p className="text-gray-500 text-xs">출고완료 탭에서 작업자가 확인 후 최종 처리하세요.</p>
            </div>
          ) : loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">FIFO 분석 중...</p>
          ) : (
            pickList.map((entry, ei) => (
              <div key={ei} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">
                    {entry.productName}
                    <span className="text-gray-500 font-normal ml-2">요청 {entry.requiredQty}{entry.unit}</span>
                  </p>
                  {!entry.fulfilled && (
                    <span className="text-xs text-red-400 bg-red-900/20 border border-red-700 px-2 py-0.5 rounded">재고 부족</span>
                  )}
                </div>
                <div className="border border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800">
                      <tr className="text-gray-400">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">로케이션</th>
                        <th className="px-3 py-2 text-center">단/좌우</th>
                        <th className="px-3 py-2 text-left">파렛트코드</th>
                        <th className="px-3 py-2 text-right">출고수량</th>
                        <th className="px-3 py-2 text-right">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {entry.picks.map((pick, pi) => (
                        <tr key={pi} className="hover:bg-gray-800/40">
                          <td className="px-3 py-2 text-gray-600">{pi + 1}</td>
                          <td className="px-3 py-2 font-bold text-white">{pick.locationCode}</td>
                          <td className="px-3 py-2 text-center text-gray-300">
                            {pick.tier}단 {SIDE_KO[pick.side]}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-400">{pick.palletCode}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-400">
                            {pick.shipQty.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {pick.isPartial && <span className="text-amber-400 text-[10px]">일부</span>}
                            {pick.isMixed  && <span className="text-purple-400 text-[10px] ml-1">혼적</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-5 border-t border-gray-700 flex gap-3">
          {done ? (
            <button onClick={onComplete}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors">
              출고완료 탭으로 →
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="px-5 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">
                취소
              </button>
              <button onClick={handleConfirm}
                disabled={confirming || loading || pickList.length === 0}
                className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white font-bold text-sm transition-colors">
                {confirming ? '처리 중...' : '✅ 지시 완료'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// ③ 출고완료
// ══════════════════════════════════════════════════
function CompleteTab({ onDone }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const [expanded, setExpanded]     = useState({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('outbound_orders')
      .select(`id, order_no, client_name, instructed_at, note,
               outbound_order_pallets (
                 ship_qty, is_partial, location_snapshot, tier, side,
                 pallets ( code )
               ),
               outbound_order_items ( required_qty, products ( name, unit ) )`)
      .eq('status', 'instructed')
      .order('instructed_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleComplete(order) {
    if (!confirm(`출고오더 ${order.order_no}을(를) 완료 처리하시겠습니까?`)) return
    setCompleting(order.id)
    try {
      const picks = order.outbound_order_pallets ?? []
      const palletIds = [...new Set(picks.map(p => p.pallets?.id ?? p.pallet_id).filter(Boolean))]

      // pallets 조회 (실제 id 필요)
      const { data: palletRows } = await supabase
        .from('outbound_order_pallets')
        .select('pallet_id, ship_qty, location_snapshot, tier, side')
        .eq('order_id', order.id)

      // 파렛트 상태 → outbound
      const { error: pErr } = await supabase
        .from('pallets').update({ status: 'outbound' })
        .in('id', (palletRows ?? []).map(r => r.pallet_id))
      if (pErr) throw pErr

      // outbound_logs 생성
      const { data: palletDetails } = await supabase
        .from('pallets').select('id, location_id, tier, side')
        .in('id', (palletRows ?? []).map(r => r.pallet_id))

      const logRows = (palletDetails ?? []).map(p => ({
        pallet_id:   p.id,
        location_id: p.location_id,
        tier:        p.tier,
        side:        p.side,
      }))
      const { error: lErr } = await supabase.from('outbound_logs').insert(logRows)
      if (lErr) throw lErr

      // 오더 완료
      const { error: oErr } = await supabase.from('outbound_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', order.id)
      if (oErr) throw oErr

      fetchOrders()
    } catch (err) {
      alert('오류: ' + err.message)
    }
    setCompleting(null)
  }

  if (loading) return <p className="text-center text-gray-500 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-gray-600 py-12">출고완료 대기 중인 오더가 없습니다.</p>

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const isExpanded = !!expanded[order.id]
        const picks = order.outbound_order_pallets ?? []
        return (
          <div key={order.id} className="wms-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-yellow-400 font-bold text-sm">{order.order_no}</span>
                  {order.client_name && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{order.client_name}</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(order.outbound_order_items ?? []).map((it, i) => (
                    <span key={i} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                      {it.products?.name} {it.required_qty}{it.products?.unit}
                    </span>
                  ))}
                </div>
                <button onClick={() => setExpanded(e => ({ ...e, [order.id]: !e[order.id] }))}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors">
                  {isExpanded ? '▲ 피킹목록 접기' : `▼ 피킹목록 보기 (${picks.length}건)`}
                </button>
              </div>
              <button onClick={() => handleComplete(order)}
                disabled={completing === order.id}
                className="shrink-0 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
                {completing === order.id ? '처리 중...' : '✅ 출고완료'}
              </button>
            </div>

            {isExpanded && picks.length > 0 && (
              <div className="border border-gray-700 rounded-xl overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800">
                    <tr className="text-gray-400">
                      <th className="px-3 py-2 text-left">로케이션</th>
                      <th className="px-3 py-2 text-center">단/좌우</th>
                      <th className="px-3 py-2 text-left">파렛트코드</th>
                      <th className="px-3 py-2 text-right">출고수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {picks.map((pick, i) => (
                      <tr key={i} className="hover:bg-gray-800/40">
                        <td className="px-3 py-2 font-bold text-white">{pick.location_snapshot}</td>
                        <td className="px-3 py-2 text-center text-gray-300">
                          {pick.tier}단 {SIDE_KO[pick.side]}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-400">{pick.pallets?.code}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-400">
                          {pick.ship_qty?.toLocaleString()}
                          {pick.is_partial && <span className="text-amber-400 text-[10px] ml-1">일부</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls = `w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
  text-white text-sm placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500`
