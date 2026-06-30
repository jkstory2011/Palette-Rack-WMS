'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { generatePalletCodes, generateOrderNo } from '@/lib/utils/pallet'
import JsBarcode from 'jsbarcode'

const TIERS = [4, 3, 2, 1]
const SIDES = ['L', 'R']

export default function InboundPage() {
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'register'
    return new URLSearchParams(window.location.search).get('tab') || 'register'
  })

  const TABS = [
    { key: 'register', label: '① 입고등록' },
    { key: 'instruct', label: '② 입고지시' },
    { key: 'complete', label: '③ 입고완료' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">입고 관리</h1>

      <div className="flex gap-2 border-b border-white/10">
        {TABS.map(({ key, label }) => (
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

      {tab === 'register' && <RegisterTab onDone={() => setTab('instruct')} />}
      {tab === 'instruct' && <InstructTab onDone={() => setTab('complete')} />}
      {tab === 'complete' && <CompleteTab onDone={() => setTab('register')} />}
    </div>
  )
}

// ══════════════════════════════════════════════════
// ① 입고등록
// ══════════════════════════════════════════════════
function RegisterTab({ onDone }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    clientName: '', scheduledDate: '', palletCount: 1, note: '',
    items: [{ productId: '', qtyPerPallet: '' }],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
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
    if (form.items.some(it => !it.productId || !it.qtyPerPallet || Number(it.qtyPerPallet) <= 0))
      return setError('상품과 파렛트당 수량을 입력하세요.')
    if (Number(form.palletCount) <= 0)
      return setError('파렛트 개수를 입력하세요.')

    setSaving(true)
    try {
      // 오더 번호 생성
      const { data: existing } = await supabase.from('inbound_orders').select('order_no')
      const orderNo = generateOrderNo((existing ?? []).map(r => r.order_no), 'IN')

      // 오더 생성
      const { data: order, error: oErr } = await supabase
        .from('inbound_orders')
        .insert({
          order_no:       orderNo,
          client_name:    form.clientName || null,
          scheduled_date: form.scheduledDate || null,
          pallet_count:   Number(form.palletCount),
          note:           form.note || null,
        })
        .select('id').single()
      if (oErr) throw oErr

      // 오더 상품 등록
      const itemRows = form.items.map(it => ({
        order_id:       order.id,
        product_id:     Number(it.productId),
        qty_per_pallet: Number(it.qtyPerPallet),
      }))
      const { error: iErr } = await supabase.from('inbound_order_items').insert(itemRows)
      if (iErr) throw iErr

      setSuccess(`✅ 입고오더 ${orderNo} 등록 완료 — 입고지시 탭에서 로케이션을 배정하세요.`)
      setForm({ clientName: '', scheduledDate: '', palletCount: 1, note: '', items: [{ productId: '', qtyPerPallet: '' }] })
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  // 파렛트당 상품 조합 총 수량
  const totalPerPallet = form.items.reduce((s, it) => s + (Number(it.qtyPerPallet) || 0), 0)
  const totalAll = totalPerPallet * (Number(form.palletCount) || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">기본 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="화주사명">
            <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="(주)OO물류" className={inputCls} />
          </Field>
          <Field label="예정 입고일">
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
        <h2 className="text-base font-semibold text-gray-300">파렛트 구성 <span className="text-xs text-gray-500 font-normal">(1파렛트 기준)</span></h2>

        <div className="space-y-2">
          {form.items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}
                className="flex-1 min-w-0 wms-select">
                <option value="">상품 선택...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min="1" placeholder="수량/파렛트"
                  value={item.qtyPerPallet} onChange={e => updateItem(i, 'qtyPerPallet', e.target.value)}
                  className="w-28 wms-input" />
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
          onClick={() => setForm(f => ({ ...f, items: [...f.items, { productId: '', qtyPerPallet: '' }] }))}
          className="text-sm text-[#F59E0B] hover:text-[#FBBF24] transition-colors">
          + 상품 추가 (혼적)
        </button>

        <div className="border-t border-white/10 pt-3 flex items-center gap-6">
          <Field label="파렛트 개수">
            <input type="number" min="1" value={form.palletCount}
              onChange={e => setForm(f => ({ ...f, palletCount: e.target.value }))}
              className="w-28 wms-input" />
          </Field>
          <div className="text-sm text-gray-400 space-y-0.5">
            <p>1파렛트당 <strong className="text-white">{totalPerPallet}</strong> 수량</p>
            <p>총 <strong className="text-[#F59E0B] text-base">{Number(form.palletCount)}개</strong> 파렛트 /
              합계 <strong className="text-white">{totalAll}</strong> 수량
            </p>
          </div>
        </div>
      </div>

      {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

      <button type="submit" disabled={saving}
        className="w-full py-4 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-black text-lg font-bold transition-colors disabled:opacity-40">
        {saving ? '등록 중...' : '입고 등록'}
      </button>
    </form>
  )
}

// ══════════════════════════════════════════════════
// ② 입고지시
// ══════════════════════════════════════════════════
function InstructTab({ onDone }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones]     = useState([])
  const [instructing, setInstructing] = useState(null)  // order being instructed

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_orders')
      .select(`id, order_no, status, client_name, scheduled_date, pallet_count, note, created_at,
               inbound_order_items ( qty_per_pallet, products ( name, unit ) )`)
      .eq('status', 'registered')
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    supabase.from('zones').select('id, code, name').order('code').then(({ data }) => setZones(data ?? []))
  }, [fetchOrders])

  if (loading) return <p className="text-center text-slate-400 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-slate-500 py-12">대기 중인 입고오더가 없습니다.</p>

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="wms-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#F59E0B] font-bold text-sm">{order.order_no}</span>
                {order.client_name && <span className="wms-tag">{order.client_name}</span>}
              </div>
              <p className="text-white font-semibold mt-0.5">
                파렛트 <strong className="text-yellow-400">{order.pallet_count}개</strong>
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(order.inbound_order_items ?? []).map((it, i) => (
                  <span key={i} className="wms-tag rounded">
                    {it.products?.name} × {it.qty_per_pallet}{it.products?.unit}
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
        <InstructModal
          order={instructing}
          zones={zones}
          onClose={() => setInstructing(null)}
          onComplete={() => { setInstructing(null); fetchOrders(); onDone() }}
        />
      )}
    </div>
  )
}

// 입고지시 모달: 로케이션 자동 배정
function InstructModal({ order, zones, onClose, onComplete }) {
  const [selectedZone, setSelectedZone] = useState('')
  const [assignment, setAssignment]     = useState([])   // [{locationId, locationCode, tier, side}]
  const [palletCodes, setPalletCodes]   = useState([])
  const [assigning, setAssigning]       = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [error, setError]               = useState('')
  const [done, setDone]                 = useState(false)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleZoneChange(zoneId) {
    setSelectedZone(zoneId)
    setAssignment([])
    setPalletCodes([])
    if (!zoneId) return

    setAssigning(true)
    setError('')
    try {
      const { data: locs } = await supabase
        .from('locations').select('id, code, slot_config').eq('zone_id', zoneId).eq('is_active', true).order('code')

      if (!locs || locs.length === 0) { setError('선택한 구역에 로케이션이 없습니다.'); setAssigning(false); return }

      const locIds = locs.map(l => l.id)
      const { data: occupied } = await supabase
        .from('pallets').select('location_id, tier, side')
        .in('location_id', locIds).in('status', ['stored', 'pending'])

      const occSet = new Set((occupied ?? []).map(p => `${p.location_id}-${p.tier}-${p.side}`))

      const slots = []
      outer: for (const loc of locs) {
        const usableSides = loc.slot_config === 'L' ? ['L'] : loc.slot_config === 'R' ? ['R'] : SIDES
        for (const tier of TIERS) {
          for (const side of usableSides) {
            if (!occSet.has(`${loc.id}-${tier}-${side}`)) {
              slots.push({ locationId: loc.id, locationCode: loc.code, tier, side })
              if (slots.length >= order.pallet_count) break outer
            }
          }
        }
      }

      if (slots.length < order.pallet_count) {
        setError(`가용 슬롯 부족 (필요 ${order.pallet_count}개 / 가용 ${slots.length}개)`)
      }

      // 파렛트 코드 생성
      const { data: existing } = await supabase.from('pallets').select('code')
        .like('code', `PLT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-%`)
      const codes = generatePalletCodes((existing ?? []).map(r => r.code), slots.length)

      setAssignment(slots)
      setPalletCodes(codes)
    } catch (err) {
      setError(err.message)
    }
    setAssigning(false)
  }

  async function handleConfirm() {
    if (assignment.length === 0) return
    setConfirming(true)
    setError('')
    try {
      // 파렛트 배치 생성 (status='pending')
      const palletRows = assignment.map((slot, i) => ({
        code:             palletCodes[i],
        location_id:      slot.locationId,
        tier:             slot.tier,
        side:             slot.side,
        status:           'pending',
        inbound_order_id: order.id,
      }))

      const { data: createdPallets, error: pErr } = await supabase
        .from('pallets').insert(palletRows).select('id')
      if (pErr) throw pErr

      // 각 파렛트에 상품 항목 등록
      const itemRows = []
      for (let pi = 0; pi < createdPallets.length; pi++) {
        for (const item of order.inbound_order_items ?? []) {
          itemRows.push({
            pallet_id:  createdPallets[pi].id,
            product_id: item.products ? null : item.product_id,  // need product_id
            qty:        item.qty_per_pallet,
          })
        }
      }

      // product_id는 order_items에서 별도 조회 필요
      const { data: orderItems } = await supabase
        .from('inbound_order_items').select('product_id, qty_per_pallet').eq('order_id', order.id)

      const palletItemRows = []
      for (const pal of createdPallets) {
        for (const oi of orderItems ?? []) {
          palletItemRows.push({ pallet_id: pal.id, product_id: oi.product_id, qty: oi.qty_per_pallet })
        }
      }

      const { error: iErr } = await supabase.from('pallet_items').insert(palletItemRows)
      if (iErr) throw iErr

      // 오더 상태 업데이트
      const { error: uErr } = await supabase.from('inbound_orders')
        .update({ status: 'instructed', instructed_at: new Date().toISOString() })
        .eq('id', order.id)
      if (uErr) throw uErr

      setDone(true)
    } catch (err) {
      setError(err.message)
    }
    setConfirming(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <h2 className="text-lg font-bold text-white">입고지시</h2>
            <p className="text-sm text-gray-400">{order.order_no} · 파렛트 {order.pallet_count}개</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {done ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-3xl">✅</p>
              <p className="text-white font-bold text-lg">입고지시 완료</p>
              <p className="text-gray-400 text-sm">파렛트 {palletCodes.length}개 로케이션 배정됨</p>
              <p className="text-gray-500 text-xs">입고완료 탭에서 작업자가 최종 확인해주세요.</p>
            </div>
          ) : (
            <>
              {/* 파렛트 구성 요약 */}
              <div className="bg-gray-800 rounded-xl p-3 text-sm">
                <p className="text-gray-400 text-xs mb-1">파렛트 구성 (1개 기준)</p>
                {(order.inbound_order_items ?? []).map((it, i) => (
                  <span key={i} className="text-gray-200">
                    {it.products?.name} × {it.qty_per_pallet}{it.products?.unit}
                    {i < order.inbound_order_items.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>

              {/* 구역 선택 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">배치 구역 선택</label>
                <select value={selectedZone} onChange={e => handleZoneChange(e.target.value)}
                  className="wms-select">
                  <option value="">구역 선택...</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
                </select>
              </div>

              {assigning && <p className="text-center text-gray-500 text-sm animate-pulse">슬롯 탐색 중...</p>}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {/* 배정 미리보기 */}
              {assignment.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">
                    자동 배정 결과 ({assignment.length}/{order.pallet_count}개)
                  </p>
                  <div className="border border-gray-700 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-800 sticky top-0">
                        <tr className="text-gray-400">
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">파렛트코드</th>
                          <th className="px-3 py-2 text-left">로케이션</th>
                          <th className="px-3 py-2 text-center">단</th>
                          <th className="px-3 py-2 text-center">좌/우</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {assignment.map((slot, i) => (
                          <tr key={i} className="hover:bg-gray-800/40">
                            <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-[#F59E0B]">{palletCodes[i]}</td>
                            <td className="px-3 py-2 font-bold text-white">{slot.locationCode}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{slot.tier}단</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                slot.side === 'L' ? 'bg-purple-600/20 text-purple-300' : 'bg-orange-600/20 text-orange-300'
                              }`}>{slot.side === 'L' ? '좌' : '우'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex gap-3">
          {done ? (
            <button onClick={onComplete}
              className="flex-1 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-black font-bold text-sm transition-colors">
              입고완료 탭으로 →
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="px-5 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">
                취소
              </button>
              <button onClick={handleConfirm}
                disabled={confirming || assignment.length < order.pallet_count || assigning}
                className="flex-1 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white font-bold text-sm transition-colors">
                {confirming ? '처리 중...' : `✅ 지시 완료 (${assignment.length}개 배정)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// ③ 입고완료
// ══════════════════════════════════════════════════
function CompleteTab({ onDone }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const [printPallets, setPrintPallets] = useState(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_orders')
      .select(`id, order_no, client_name, pallet_count, instructed_at,
               inbound_order_items ( qty_per_pallet, products ( name, unit ) )`)
      .eq('status', 'instructed')
      .order('instructed_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function handleComplete(order) {
    setCompleting(order.id)
    try {
      // 이 오더에 속한 pending 파렛트 조회
      const { data: pallets } = await supabase
        .from('pallets')
        .select('id, code, location_id, tier, side, locations(code)')
        .eq('inbound_order_id', order.id)
        .eq('status', 'pending')

      if (!pallets || pallets.length === 0) {
        alert('처리할 파렛트가 없습니다.')
        setCompleting(null)
        return
      }

      // 1) pallets status → stored
      const palletIds = pallets.map(p => p.id)
      const { error: pErr } = await supabase
        .from('pallets').update({ status: 'stored' }).in('id', palletIds)
      if (pErr) throw pErr

      // 2) inbound_logs 생성
      const logRows = pallets.map(p => ({
        pallet_id:   p.id,
        location_id: p.location_id,
        tier:        p.tier,
        side:        p.side,
      }))
      const { error: lErr } = await supabase.from('inbound_logs').insert(logRows)
      if (lErr) throw lErr

      // 3) 오더 완료 처리
      const { error: oErr } = await supabase.from('inbound_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', order.id)
      if (oErr) throw oErr

      // 라벨 출력을 위해 팔레트 정보 저장
      const labelData = pallets.map(p => ({
        code:         p.code,
        locationCode: p.locations?.code ?? '',
        tier:         p.tier,
        side:         p.side,
        inboundAt:    new Date(),
        items:        (order.inbound_order_items ?? []).map(it => ({
          productName: it.products?.name ?? '',
          unit:        it.products?.unit ?? '',
          qty:         it.qty_per_pallet,
        })),
      }))
      setPrintPallets(labelData)
      fetchOrders()
    } catch (err) {
      alert('오류: ' + err.message)
    }
    setCompleting(null)
  }

  if (loading) return <p className="text-center text-slate-400 py-12 animate-pulse">불러오는 중...</p>
  if (orders.length === 0)
    return <p className="text-center text-slate-500 py-12">입고완료 대기 중인 오더가 없습니다.</p>

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="wms-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-yellow-400 font-bold text-sm">{order.order_no}</span>
                {order.client_name && <span className="wms-tag">{order.client_name}</span>}
              </div>
              <p className="text-white font-semibold mt-0.5">파렛트 <strong className="text-yellow-400">{order.pallet_count}개</strong> — 작업자 확인 대기</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(order.inbound_order_items ?? []).map((it, i) => (
                  <span key={i} className="wms-tag rounded">
                    {it.products?.name} × {it.qty_per_pallet}{it.products?.unit}
                  </span>
                ))}
              </div>
              {order.instructed_at && (
                <p className="text-xs text-gray-500 mt-1">
                  지시일시: {new Date(order.instructed_at).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
            <button onClick={() => handleComplete(order)}
              disabled={completing === order.id}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">
              {completing === order.id ? '처리 중...' : '✅ 입고완료'}
            </button>
          </div>
        </div>
      ))}

      {printPallets && (
        <BatchLabelModal pallets={printPallets} onClose={() => { setPrintPallets(null); onDone() }} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
// 배치 라벨 출력 모달
// ══════════════════════════════════════════════════
function BatchLabelModal({ pallets, onClose }) {
  const [current, setCurrent] = useState(0)
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !pallets[current]) return
    JsBarcode(svgRef.current, pallets[current].code, {
      format: 'CODE128', width: 2.2, height: 72,
      displayValue: true, fontSize: 13, margin: 8,
      background: '#ffffff', lineColor: '#000000',
    })
  }, [current, pallets])

  function handlePrint() {
    document.body.classList.add('printing-label')
    window.print()
    document.body.classList.remove('printing-label')
  }

  const label = pallets[current]

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        <div className="bg-gray-800 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">🖨️ 파렛트 라벨 출력</p>
            <p className="text-gray-400 text-xs">{current + 1} / {pallets.length}개</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="label-print-area bg-white p-5 text-black">
          <div className="text-center mb-3">
            <svg ref={svgRef} className="w-full" />
          </div>
          <div className="border-t border-gray-300 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">로케이션</span>
              <span className="font-bold text-lg">{label.locationCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">위치</span>
              <span className="font-bold">{label.tier}단 {label.side === 'L' ? '좌(L)' : '우(R)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">입고일</span>
              <span className="font-semibold">{label.inboundAt.toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
          <div className="border-t border-gray-300 mt-3 pt-3">
            {label.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-medium truncate mr-2">{it.productName}</span>
                <span className="font-bold shrink-0 text-gray-700">{it.qty} {it.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="no-print bg-gray-50 border-t border-gray-200 p-4 space-y-2">
          <button onClick={handlePrint}
            className="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-black font-bold text-sm">
            🖨️ 라벨 인쇄
          </button>
          <div className="flex gap-2">
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-sm disabled:opacity-40">
              ← 이전
            </button>
            <button onClick={() => setCurrent(c => Math.min(pallets.length - 1, c + 1))} disabled={current === pallets.length - 1}
              className="flex-1 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold text-sm disabled:opacity-40">
              다음 →
            </button>
          </div>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm">
            완료 (닫기)
          </button>
        </div>
      </div>
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

const inputCls = 'wms-input'
