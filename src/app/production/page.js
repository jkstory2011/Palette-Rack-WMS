'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateOrderNo } from '@/lib/utils/pallet'

const STATUS_LABEL = {
  registered:  { label: '등록',   cls: 'bg-blue-600/20 text-blue-400 border-blue-600/40' },
  in_progress: { label: '생산중', cls: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40' },
  completed:   { label: '완료',   cls: 'bg-green-600/20 text-green-400 border-green-600/40' },
}

export default function ProductionPage() {
  const [tab, setTab] = useState('register')

  const TABS = [
    { key: 'register',    label: '① 생산등록' },
    { key: 'in_progress', label: '② 생산중' },
    { key: 'completed',   label: '③ 생산완료' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">생산 관리</h1>
      <p className="text-xs text-gray-500">화주사 오더 기반 센터 내 적재·생산 작업 프로세스</p>

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

      {tab === 'register'    && <RegisterTab    onDone={() => setTab('in_progress')} />}
      {tab === 'in_progress' && <InProgressTab  onDone={() => setTab('completed')} />}
      {tab === 'completed'   && <CompletedTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════
// ① 생산등록
// ══════════════════════════════════════════════════
function RegisterTab({ onDone }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    clientName: '', scheduledDate: '', note: '',
    items: [{ productId: '', targetQty: '' }],
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
    if (form.items.some(it => !it.productId || !it.targetQty || Number(it.targetQty) <= 0))
      return setError('상품과 생산 목표수량을 입력하세요.')

    setSaving(true)
    try {
      const { data: existing } = await supabase.from('production_orders').select('order_no')
      const orderNo = generateOrderNo((existing ?? []).map(r => r.order_no), 'PRD')

      const { data: order, error: oErr } = await supabase
        .from('production_orders')
        .insert({
          order_no:       orderNo,
          client_name:    form.clientName || null,
          scheduled_date: form.scheduledDate || null,
          note:           form.note || null,
        })
        .select('id').single()
      if (oErr) throw oErr

      const itemRows = form.items.map(it => ({
        order_id:   order.id,
        product_id: Number(it.productId),
        target_qty: Number(it.targetQty),
      }))
      const { error: iErr } = await supabase.from('production_order_items').insert(itemRows)
      if (iErr) throw iErr

      setSuccess(`✅ 생산오더 ${orderNo} 등록 완료`)
      setForm({ clientName: '', scheduledDate: '', note: '', items: [{ productId: '', targetQty: '' }] })
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
          <Field label="예정 생산일">
            <input type="date" value={form.scheduledDate}
              onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="메모">
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="작업 내용 등" className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">생산 상품 및 목표수량</h2>
        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="">상품 선택...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min="1" placeholder="목표수량"
                  value={item.targetQty} onChange={e => updateItem(i, 'targetQty', e.target.value)}
                  className="w-28 bg-gray-800 border border-gray-600 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
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
          onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: '', targetQty: '' }] }))}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          + 상품 추가
        </button>
      </div>

      {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold transition-colors disabled:opacity-40">
        {saving ? '등록 중...' : '🏭 생산 등록'}
      </button>
    </form>
  )
}

// ══════════════════════════════════════════════════
// ② 생산중
// ══════════════════════════════════════════════════
function InProgressTab({ onDone }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('production_orders')
      .select(`id, order_no, status, client_name, scheduled_date, note, created_at, started_at,
               production_order_items ( target_qty, produced_qty, products ( name, unit ) )`)
      .in('status', ['registered', 'in_progress'])
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleStart(order) {
    const { error } = await supabase.from('production_orders')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', order.id)
    if (!error) fetchOrders()
  }

  async function handleComplete(order, producedMap) {
    setUpdating(order.id)
    try {
      // 생산수량 업데이트
      for (const item of order.production_order_items ?? []) {
        const produced = Number(producedMap[item.id] ?? item.target_qty)
        await supabase.from('production_order_items')
          .update({ produced_qty: produced })
          .eq('id', item.id)
      }

      // 오더 완료
      const { error: oErr } = await supabase.from('production_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', order.id)
      if (oErr) throw oErr

      fetchOrders()
      onDone()
    } catch (err) {
      alert('오류: ' + err.message)
    }
    setUpdating(null)
  }

  if (loading) return <p className="text-center text-gray-500 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-gray-600 py-12">진행 중인 생산오더가 없습니다.</p>

  return (
    <div className="space-y-4">
      {orders.map(order => (
        <ProductionOrderCard
          key={order.id}
          order={order}
          onStart={() => handleStart(order)}
          onComplete={(producedMap) => handleComplete(order, producedMap)}
          isUpdating={updating === order.id}
        />
      ))}
    </div>
  )
}

function ProductionOrderCard({ order, onStart, onComplete, isUpdating }) {
  const [producedMap, setProducedMap] = useState({})
  const st = STATUS_LABEL[order.status] ?? STATUS_LABEL.registered

  return (
    <div className="wms-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-blue-400 font-bold text-sm">{order.order_no}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
            {order.client_name && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{order.client_name}</span>}
          </div>
          {order.scheduled_date && <p className="text-xs text-gray-500 mt-1">예정일: {order.scheduled_date}</p>}
          {order.note && <p className="text-xs text-gray-500">{order.note}</p>}
        </div>
        {order.status === 'registered' && (
          <button onClick={onStart}
            className="shrink-0 px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold transition-colors">
            생산 시작
          </button>
        )}
      </div>

      <div className="space-y-2">
        {(order.production_order_items ?? []).map((item, i) => {
          const pct = item.target_qty > 0
            ? Math.min(100, Math.round((Number(producedMap[item.id] ?? item.produced_qty) / item.target_qty) * 100))
            : 0
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{item.products?.name}</span>
                <div className="flex items-center gap-2">
                  {order.status === 'in_progress' ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max={item.target_qty}
                        placeholder={String(item.target_qty)}
                        value={producedMap[item.id] ?? ''}
                        onChange={e => setProducedMap(m => ({ ...m, [item.id]: e.target.value }))}
                        className="w-20 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm text-center" />
                      <span className="text-gray-500 text-xs">/ {item.target_qty} {item.products?.unit}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">{item.produced_qty} / {item.target_qty} {item.products?.unit}</span>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {order.status === 'in_progress' && (
        <button onClick={() => onComplete(producedMap)} disabled={isUpdating}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold text-sm transition-colors">
          {isUpdating ? '처리 중...' : '✅ 생산 완료'}
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
// ③ 생산완료 이력
// ══════════════════════════════════════════════════
function CompletedTab() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('production_orders')
      .select(`id, order_no, client_name, completed_at, note,
               production_order_items ( target_qty, produced_qty, products ( name, unit ) )`)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setOrders(data ?? []); setLoading(false) })
  }, [])

  if (loading) return <p className="text-center text-gray-500 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-gray-600 py-12">완료된 생산오더가 없습니다.</p>

  return (
    <div className="wms-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-700 text-left">
            <th className="pb-2 font-medium">완료일시</th>
            <th className="pb-2 font-medium">오더번호</th>
            <th className="pb-2 font-medium">화주사</th>
            <th className="pb-2 font-medium">생산 상품</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {orders.map(order => (
            <tr key={order.id} className="hover:bg-gray-800/40 align-top">
              <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                {order.completed_at ? new Date(order.completed_at).toLocaleString('ko-KR') : '—'}
              </td>
              <td className="py-3 font-mono text-xs text-blue-400">{order.order_no}</td>
              <td className="py-3 text-xs text-gray-400">{order.client_name ?? '—'}</td>
              <td className="py-3">
                <ul className="space-y-0.5">
                  {(order.production_order_items ?? []).map((it, i) => (
                    <li key={i} className="text-xs text-gray-300">
                      {it.products?.name}
                      <span className="text-gray-500 ml-1">
                        {it.produced_qty} / {it.target_qty} {it.products?.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
