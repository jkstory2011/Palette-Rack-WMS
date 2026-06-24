'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generatePalletCode } from '@/lib/utils/pallet'
import BarcodeInput from '@/components/BarcodeInput'

const TIERS = [4, 3, 2, 1]
const SIDES = ['L', 'R']
const SIDE_KO = { L: '좌(L)', R: '우(R)' }

// 초기 폼 상태
const INIT_FORM = {
  palletCode:  '',
  locationId:  '',
  tier:        '',
  side:        '',
  items:       [{ productId: '', qty: '' }],  // 혼적: 상품 행 여러 개
}

export default function InboundPage() {
  const [form, setForm]             = useState(INIT_FORM)
  const [zones, setZones]           = useState([])
  const [selectedZone, setSelectedZone] = useState('')
  const [locations, setLocations]   = useState([])   // 선택 구역의 로케이션들
  const [emptySlots, setEmptySlots] = useState([])   // 선택 로케이션의 빈 슬롯
  const [products, setProducts]     = useState([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  // ── 초기 데이터 로드
  useEffect(() => {
    Promise.all([
      supabase.from('zones').select('id, code, name').order('code'),
      supabase.from('products').select('id, code, name, unit').order('name'),
    ]).then(([{ data: z }, { data: p }]) => {
      setZones(z ?? [])
      setProducts(p ?? [])
    })
  }, [])

  // ── 파렛트 코드 자동 생성
  async function handleAutoCode() {
    const { data } = await supabase
      .from('pallets')
      .select('code')
      .like('code', `PLT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-%%`)
    const code = generatePalletCode((data ?? []).map((r) => r.code))
    setForm((f) => ({ ...f, palletCode: code }))
  }

  // ── 구역 변경 → 해당 구역 로케이션 로드
  const handleZoneChange = useCallback(async (zoneId) => {
    setSelectedZone(zoneId)
    setForm((f) => ({ ...f, locationId: '', tier: '', side: '' }))
    setEmptySlots([])

    if (!zoneId) { setLocations([]); return }

    const { data } = await supabase
      .from('locations')
      .select('id, code, grid_x, grid_y')
      .eq('zone_id', zoneId)
      .eq('is_active', true)
      .order('code')

    setLocations(data ?? [])
  }, [])

  // ── 로케이션 변경 → 빈 슬롯 계산
  const handleLocationChange = useCallback(async (locationId) => {
    setForm((f) => ({ ...f, locationId, tier: '', side: '' }))
    if (!locationId) { setEmptySlots([]); return }

    // 현재 점유된 슬롯 조회
    const { data: occupied } = await supabase
      .from('pallets')
      .select('tier, side')
      .eq('location_id', locationId)
      .eq('status', 'stored')

    // 전체 8슬롯 중 비어 있는 것만 추출
    const occupiedSet = new Set((occupied ?? []).map((p) => `${p.tier}-${p.side}`))
    const empty = []
    for (const tier of TIERS) {
      for (const side of SIDES) {
        if (!occupiedSet.has(`${tier}-${side}`)) {
          empty.push({ tier, side })
        }
      }
    }
    setEmptySlots(empty)
  }, [])

  // ── 혼적 상품 행 추가/수정/삭제
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { productId: '', qty: '' }] }))
  }
  function updateItem(i, field, val) {
    setForm((f) => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: val }
      return { ...f, items }
    })
  }
  function removeItem(i) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  }

  // ── 제출
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    // 유효성 검사
    if (!form.palletCode.trim())  return setError('파렛트 코드를 입력하세요.')
    if (!form.locationId)         return setError('로케이션을 선택하세요.')
    if (!form.tier || !form.side) return setError('슬롯(단/좌우)을 선택하세요.')
    if (form.items.some((it) => !it.productId || !it.qty || Number(it.qty) <= 0))
      return setError('상품과 수량을 모두 입력하세요.')
    if (new Set(form.items.map((it) => it.productId)).size < form.items.length)
      return setError('같은 상품이 중복되어 있습니다.')

    setSaving(true)
    try {
      // 1) 파렛트 INSERT
      const { data: palletRow, error: pErr } = await supabase
        .from('pallets')
        .insert({
          code:        form.palletCode.trim(),
          location_id: Number(form.locationId),
          tier:        Number(form.tier),
          side:        form.side,
        })
        .select('id')
        .single()

      if (pErr) throw pErr

      // 2) 혼적 아이템 INSERT
      const itemRows = form.items.map((it) => ({
        pallet_id:  palletRow.id,
        product_id: Number(it.productId),
        qty:        Number(it.qty),
      }))
      const { error: iErr } = await supabase.from('pallet_items').insert(itemRows)
      if (iErr) throw iErr

      // 3) 입고 이력 INSERT
      await supabase.from('inbound_logs').insert({
        pallet_id:   palletRow.id,
        location_id: Number(form.locationId),
        tier:        Number(form.tier),
        side:        form.side,
      })

      setSuccess(`✅ 파렛트 ${form.palletCode} 입고 완료`)
      setForm(INIT_FORM)
      setSelectedZone('')
      setLocations([])
      setEmptySlots([])
    } catch (err) {
      setError(
        err.code === '23505'
          ? '해당 슬롯에 이미 파렛트가 있거나, 동일한 파렛트 코드가 존재합니다.'
          : err.message,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">입고 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── STEP 1: 파렛트 코드 */}
        <Section step="1" title="파렛트 코드">
          <BarcodeInput
            value={form.palletCode}
            onChange={(v) => setForm((f) => ({ ...f, palletCode: v }))}
            onScan={(code) => setForm((f) => ({ ...f, palletCode: code }))}
            placeholder="스캔하거나 PLT-YYYYMMDD-NNN 입력"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAutoCode}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ↻ 코드 자동 생성
          </button>
        </Section>

        {/* ── STEP 2: 로케이션 선택 */}
        <Section step="2" title="로케이션 선택">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 구역 선택 */}
            <div>
              <label className={labelCls}>구역</label>
              <select
                value={selectedZone}
                onChange={(e) => handleZoneChange(e.target.value)}
                className={selectCls}
              >
                <option value="">구역 선택...</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.code} — {z.name}</option>
                ))}
              </select>
            </div>

            {/* 로케이션 선택 */}
            <div>
              <label className={labelCls}>랙 (로케이션)</label>
              <select
                value={form.locationId}
                onChange={(e) => handleLocationChange(e.target.value)}
                disabled={!selectedZone}
                className={selectCls}
              >
                <option value="">랙 선택...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 빈 슬롯 선택 */}
          {emptySlots.length > 0 && (
            <div className="mt-3">
              <label className={labelCls}>빈 슬롯 선택 ({emptySlots.length}개 남음)</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-1">
                {TIERS.map((tier) =>
                  SIDES.map((side) => {
                    const isEmpty = emptySlots.some((s) => s.tier === tier && s.side === side)
                    const isSelected = form.tier === String(tier) && form.side === side
                    return (
                      <button
                        key={`${tier}-${side}`}
                        type="button"
                        disabled={!isEmpty}
                        onClick={() => setForm((f) => ({ ...f, tier: String(tier), side }))}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${
                          !isEmpty
                            ? 'bg-red-900/40 text-red-700 border border-red-800 cursor-not-allowed'
                            : isSelected
                              ? 'bg-blue-600 text-white border border-blue-500 scale-105'
                              : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                        }`}
                      >
                        {tier}단
                        <br />
                        {SIDE_KO[side]}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
          )}
          {form.locationId && emptySlots.length === 0 && (
            <p className="mt-2 text-sm text-red-400">이 랙은 모든 슬롯이 사용 중입니다.</p>
          )}
        </Section>

        {/* ── STEP 3: 상품 등록 (혼적 지원) */}
        <Section step="3" title="상품 등록 (혼적 가능)">
          <div className="space-y-2">
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <select
                  value={item.productId}
                  onChange={(e) => updateItem(i, 'productId', e.target.value)}
                  className={`${selectCls} flex-1`}
                >
                  <option value="">상품 선택...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="수량"
                  value={item.qty}
                  onChange={(e) => updateItem(i, 'qty', e.target.value)}
                  className={`${inputCls} w-24 shrink-0`}
                />
                {/* 상품 단위 표시 */}
                <span className="text-gray-500 text-sm self-center w-8 shrink-0">
                  {products.find((p) => String(p.id) === String(item.productId))?.unit ?? ''}
                </span>
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-gray-600 hover:text-red-400 text-lg self-center shrink-0 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            + 상품 추가 (혼적)
          </button>
        </Section>

        {/* ── 피드백 */}
        {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
        {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

        {/* ── 제출 버튼 */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white text-lg font-bold transition-colors
                     disabled:opacity-40 active:scale-[0.99]"
        >
          {saving ? '입고 처리 중...' : '📦 입고 등록'}
        </button>
      </form>
    </div>
  )
}

// ── 섹션 래퍼
function Section({ step, title, children }) {
  return (
    <div className="wms-card space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs
                         font-black flex items-center justify-center shrink-0">
          {step}
        </span>
        <h2 className="text-base font-semibold text-gray-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── 공통 CSS 클래스
const inputCls = `
  w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
  text-white text-sm placeholder-gray-500
  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
`
const selectCls = `
  w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
  text-white text-sm
  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
  disabled:opacity-40 disabled:cursor-not-allowed
`
const labelCls = 'block text-xs font-medium text-gray-400 mb-1'
