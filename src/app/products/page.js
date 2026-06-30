'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const EMPTY_FORM = {
  code: '', name: '', unit: 'BOX', barcode: '',
  client_name: '', expiry_at: '', mgmt_location: '', box_qty: '',
}

export default function ProductsPage() {
  const [products, setProducts]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [form, setForm]                       = useState(EMPTY_FORM)
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState('')
  const [search, setSearch]                   = useState('')
  const [clientFilter, setClientFilter]       = useState('전체')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [rackLocations, setRackLocations]     = useState([])
  const [loadingModal, setLoadingModal]       = useState(false)
  const [showExcelModal, setShowExcelModal]   = useState(false)
  const [selectedIds, setSelectedIds]         = useState(new Set())
  const [editingId, setEditingId]             = useState(null)
  const [editForm, setEditForm]               = useState({})
  const [clientsList, setClientsList]         = useState([])
  const allCheckRef = useRef(null)

  useEffect(() => {
    supabase.from('clients').select('name').order('name')
      .then(({ data }) => setClientsList((data ?? []).map(c => c.name)))
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select(`
        id, code, name, unit, barcode, client_name, expiry_at,
        mgmt_location, box_qty, created_at,
        pallet_items (
          qty,
          pallets ( status, location_id, inbound_at )
        )
      `)
      .order('created_at', { ascending: false })

    const enriched = (data ?? []).map((p) => {
      const stored    = (p.pallet_items ?? []).filter((it) => it.pallets?.status === 'stored')
      const totalQty  = stored.reduce((s, it) => s + (it.qty ?? 0), 0)
      const storedQty = stored.filter((it) => it.pallets?.location_id != null)
                               .reduce((s, it) => s + (it.qty ?? 0), 0)
      const dates     = stored.map((it) => it.pallets?.inbound_at).filter(Boolean)
      const lastInbound = dates.length > 0 ? dates.sort().at(-1) : null
      return { ...p, totalQty, storedQty, lastInbound }
    })

    setProducts(enriched)
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  // 화주사 목록 (중복 제거, '전체' 포함)
  const clientList = ['전체', ...Array.from(
    new Set(products.map(p => p.client_name).filter(Boolean))
  ).sort()]

  const openModal = useCallback(async (product) => {
    setSelectedProduct(product)
    setRackLocations([])
    setLoadingModal(true)
    const { data } = await supabase
      .from('pallet_items')
      .select(`qty, pallets ( code, tier, side, status, inbound_at, expiry_at, locations ( code ) )`)
      .eq('product_id', product.id)
    const stored = (data ?? [])
      .filter((it) => it.pallets?.status === 'stored')
      .sort((a, b) => new Date(a.pallets.inbound_at) - new Date(b.pallets.inbound_at))
    setRackLocations(stored)
    setLoadingModal(false)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim() || !form.name.trim()) {
      setError('상품코드와 상품명은 필수입니다.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('products').insert({
      code:          form.code.trim(),
      name:          form.name.trim(),
      unit:          form.unit.trim() || 'EA',
      barcode:       form.barcode.trim()       || null,
      client_name:   form.client_name.trim()   || null,
      expiry_at:     form.expiry_at             || null,
      mgmt_location: form.mgmt_location.trim() || null,
      box_qty:       form.box_qty ? Number(form.box_qty) : null,
    })
    setSaving(false)
    if (err) {
      setError(err.code === '23505' ? '이미 존재하는 상품코드입니다.' : err.message)
      return
    }
    setForm(EMPTY_FORM)
    fetchProducts()
  }

  async function handleDelete(id) {
    if (!confirm('이 상품을 삭제하면 연결된 재고 데이터에 영향을 줄 수 있습니다. 계속할까요?')) return
    await supabase.from('products').delete().eq('id', id)
    fetchProducts()
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditForm({
      name:          p.name          ?? '',
      unit:          p.unit          ?? 'BOX',
      barcode:       p.barcode       ?? '',
      client_name:   p.client_name   ?? '',
      expiry_at:     p.expiry_at     ?? '',
      mgmt_location: p.mgmt_location ?? '',
      box_qty:       p.box_qty       ?? '',
    })
  }

  async function handleEditSave(id) {
    await supabase.from('products').update({
      name:          editForm.name.trim()          || null,
      unit:          editForm.unit.trim()          || 'EA',
      barcode:       editForm.barcode.trim()       || null,
      client_name:   editForm.client_name.trim()   || null,
      expiry_at:     editForm.expiry_at            || null,
      mgmt_location: editForm.mgmt_location.trim() || null,
      box_qty:       editForm.box_qty ? Number(editForm.box_qty) : null,
    }).eq('id', id)
    setEditingId(null)
    fetchProducts()
  }

  useEffect(() => {
    if (!allCheckRef.current) return
    allCheckRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length
  })

  function toggleSelect(id) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)))
  }
  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (!confirm(`${ids.length}개 상품을 삭제할까요?\n연결된 재고 데이터에 영향을 줄 수 있습니다.`)) return
    for (const id of ids) await supabase.from('products').delete().eq('id', id)
    setSelectedIds(new Set()); fetchProducts()
  }

  // 화주사 + 검색어 필터
  const filtered = products.filter((p) => {
    if (clientFilter !== '전체' && p.client_name !== clientFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q) ||
      (p.client_name ?? '').toLowerCase().includes(q) ||
      (p.mgmt_location ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex gap-5 items-start">

      {/* ── 왼쪽 화주사 사이드바 */}
      <aside className="w-44 shrink-0 sticky top-20">
        <div className="wms-card p-3 space-y-1">
          <p className="text-xs font-semibold text-gray-500 px-2 pb-1">화주사</p>
          {clientList.map(client => (
            <button key={client}
              onClick={() => setClientFilter(client)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors truncate ${
                clientFilter === client
                  ? 'bg-[#F59E0B] text-black font-semibold'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}>
              {client === '전체' ? '전체' : client}
              {client !== '전체' && (
                <span className="ml-1 text-xs text-gray-500">
                  ({products.filter(p => p.client_name === client).length})
                </span>
              )}
            </button>
          ))}
          {clientList.length === 1 && (
            <p className="text-xs text-gray-600 px-2 py-1">등록된 화주사 없음</p>
          )}
        </div>
      </aside>

      {/* ── 오른쪽 메인 */}
      <div className="flex-1 min-w-0 space-y-6">
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">상품 마스터</h1>

        {/* ── 등록 폼 */}
        <form onSubmit={handleSubmit} className="wms-card space-y-4">
          <h2 className="text-base font-semibold text-gray-300">신규 상품 등록</h2>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FieldInput label="상품코드 *" placeholder="PRD-001"
              value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} />
            <FieldInput label="상품명 *" placeholder="삼다수 2L 6입"
              value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <FieldInput label="바코드" placeholder="8801234567890"
              value={form.barcode} onChange={v => setForm(f => ({ ...f, barcode: v }))} />
            <FieldInput label="단위" placeholder="BOX / EA / SET"
              value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} />
          </div>

          {/* 추가 정보 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">화주사명</label>
              <input list="clients-list" value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                placeholder="(주)OO물류" className={inputCls} />
              <datalist id="clients-list">
                {clientsList.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">유통/취급기한</label>
              <input type="date" value={form.expiry_at}
                onChange={e => setForm(f => ({ ...f, expiry_at: e.target.value }))}
                className={inputCls} />
            </div>
            <FieldInput label="상품관리 로케이션" placeholder="A-01, B구역 등"
              value={form.mgmt_location} onChange={v => setForm(f => ({ ...f, mgmt_location: v }))} />
            <FieldInput label="BOX 내품수량" placeholder="24" type="number"
              value={form.box_qty} onChange={v => setForm(f => ({ ...f, box_qty: v }))} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-between">
            <button type="button" onClick={() => setShowExcelModal(true)}
              className="px-8 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600
                         text-white font-semibold transition-colors flex items-center gap-2">
              📊 엑셀 일괄등록
            </button>
            <button type="submit" disabled={saving}
              className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                         text-white font-semibold transition-colors disabled:opacity-40">
              {saving ? '등록 중...' : '+ 상품 등록'}
            </button>
          </div>
        </form>

        {/* ── 검색 + 목록 */}
        <div className="wms-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-300">
              {clientFilter === '전체' ? '전체 상품' : clientFilter}
              <span className="text-gray-500 font-normal ml-1">({filtered.length}종)</span>
            </h2>
            <input type="search" placeholder="코드, 이름, 바코드, 로케이션 검색..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="wms-input py-2 w-60" />
          </div>

          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-600 py-8">등록된 상품이 없습니다.</p>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-red-950/40 border border-red-700/40
                                rounded-xl px-4 py-2 mb-3">
                  <span className="text-sm text-red-300 font-semibold">{selectedIds.size}개 선택됨</span>
                  <button onClick={handleBulkDelete}
                    className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                    🗑 선택 삭제
                  </button>
                </div>
              )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                    <th className="pb-2 w-8">
                      <input type="checkbox" ref={allCheckRef}
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleAll} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    </th>
                    <th className="pb-2 font-medium pr-3 w-24">상품코드</th>
                    <th className="pb-2 font-medium pr-3">상품명</th>
                    <th className="pb-2 font-medium pr-3 w-28">화주사명</th>
                    <th className="pb-2 font-medium pr-3 w-28">관리 로케이션</th>
                    <th className="pb-2 font-medium pr-3 w-20 text-center">내품수량</th>
                    <th className="pb-2 font-medium pr-3 w-28">바코드</th>
                    <th className="pb-2 font-medium pr-3 w-24">입고일</th>
                    <th className="pb-2 font-medium pr-3 w-24">유통기한</th>
                    <th className="pb-2 font-medium text-right pr-3 w-20">전체재고</th>
                    <th className="pb-2 font-medium text-right pr-3 w-20">현적재</th>
                    <th className="pb-2 w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtered.map((p) => {
                    const isEditing = editingId === p.id
                    const now       = new Date()
                    const expiry    = p.expiry_at ? new Date(p.expiry_at) : null
                    const daysLeft  = expiry ? Math.ceil((expiry - now) / 86400000) : null
                    const isExpired      = daysLeft !== null && daysLeft <= 0
                    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30

                    const eic = 'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500'

                    return (
                      <tr key={p.id}
                        onClick={() => { if (!isEditing) openModal(p) }}
                        className={`hover:bg-gray-800/60 transition-colors ${isEditing ? 'bg-blue-950/30' : 'cursor-pointer'} ${selectedIds.has(p.id) ? 'bg-blue-950/20' : ''}`}>

                        {/* 체크박스 */}
                        <td className="py-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                            className="w-4 h-4 accent-blue-500 cursor-pointer" />
                        </td>

                        {/* 상품코드 (수정 불가) */}
                        <td className="py-2 font-mono text-gray-300 pr-3 text-xs">{p.code}</td>

                        {/* 상품명 + 단위 */}
                        <td className="py-2 pr-3" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input className={eic} value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="상품명" />
                              <input className={`${eic} w-16`} value={editForm.unit}
                                onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                                placeholder="단위" />
                            </div>
                          ) : (
                            <>
                              <span className="text-white font-medium">{p.name}</span>
                              <span className="text-gray-600 text-xs ml-1.5">{p.unit}</span>
                            </>
                          )}
                        </td>

                        {/* 화주사명 */}
                        <td className="py-2 pr-3 text-xs" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <input className={eic} value={editForm.client_name}
                              onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                              placeholder="화주사명" />
                          ) : p.client_name ? (
                            <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{p.client_name}</span>
                          ) : <span className="text-gray-700">—</span>}
                        </td>

                        {/* 관리 로케이션 */}
                        <td className="py-2 pr-3 text-xs" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <input className={eic} value={editForm.mgmt_location}
                              onChange={e => setEditForm(f => ({ ...f, mgmt_location: e.target.value }))}
                              placeholder="A-01 등" />
                          ) : p.mgmt_location ? (
                            <span className="text-[#F59E0B] font-mono bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-0.5 rounded">
                              {p.mgmt_location}
                            </span>
                          ) : <span className="text-gray-700">—</span>}
                        </td>

                        {/* BOX 내품수량 */}
                        <td className="py-2 pr-3 text-center text-xs" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <input className={eic} type="number" value={editForm.box_qty}
                              onChange={e => setEditForm(f => ({ ...f, box_qty: e.target.value }))}
                              placeholder="24" />
                          ) : p.box_qty ? (
                            <span className="text-yellow-400 font-bold">{p.box_qty.toLocaleString()}</span>
                          ) : <span className="text-gray-700">—</span>}
                        </td>

                        {/* 바코드 */}
                        <td className="py-2 font-mono text-gray-400 pr-3 text-xs" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <input className={eic} value={editForm.barcode}
                              onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))}
                              placeholder="바코드" />
                          ) : (p.barcode ?? <span className="text-gray-700">—</span>)}
                        </td>

                        {/* 입고일 (표시 전용) */}
                        <td className="py-2 text-gray-400 text-xs pr-3">
                          {p.lastInbound
                            ? new Date(p.lastInbound).toLocaleDateString('ko-KR')
                            : <span className="text-gray-700">—</span>}
                        </td>

                        {/* 유통기한 */}
                        <td className="py-2 text-xs pr-3" onClick={e => isEditing && e.stopPropagation()}>
                          {isEditing ? (
                            <input type="date" className={eic} value={editForm.expiry_at}
                              onChange={e => setEditForm(f => ({ ...f, expiry_at: e.target.value }))} />
                          ) : expiry ? (
                            <span className={isExpired ? 'text-red-500 font-bold' : isExpiringSoon ? 'text-yellow-400 font-semibold' : 'text-gray-400'}>
                              {expiry.toLocaleDateString('ko-KR')}
                              {isExpired && ' ⚠'}{isExpiringSoon && ` D-${daysLeft}`}
                            </span>
                          ) : <span className="text-gray-700">—</span>}
                        </td>

                        {/* 전체재고 */}
                        <td className="py-2 text-right font-mono text-gray-300 pr-3">
                          {p.totalQty > 0 ? p.totalQty.toLocaleString() : <span className="text-gray-700">0</span>}
                        </td>

                        {/* 현적재 */}
                        <td className="py-2 text-right font-mono pr-3">
                          <span className={p.storedQty > 0 ? 'text-green-400 font-semibold' : 'text-gray-600'}>
                            {p.storedQty.toLocaleString()}
                          </span>
                        </td>

                        {/* 액션 */}
                        <td className="py-2 text-right" onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => handleEditSave(p.id)}
                                className="text-xs px-2 py-1 rounded bg-[#F59E0B] hover:bg-[#FBBF24] text-black font-semibold transition-colors">
                                저장
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => startEdit(p)}
                                className="text-xs text-gray-500 hover:text-[#FBBF24] transition-colors px-2 py-1">
                                수정
                              </button>
                              <button onClick={() => handleDelete(p.id)}
                                className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
                                삭제
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {/* ── 로케이션 팝업 */}
      {selectedProduct && (
        <LocationModal
          product={selectedProduct}
          locations={rackLocations}
          loading={loadingModal}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* ── 엑셀 일괄등록 모달 */}
      {showExcelModal && (
        <ExcelImportModal
          onClose={() => setShowExcelModal(false)}
          onSuccess={() => { setShowExcelModal(false); fetchProducts() }}
        />
      )}
    </div>
  )
}

/* ── 엑셀 일괄등록 모달 */
function ExcelImportModal({ onClose, onSuccess }) {
  const fileRef = useRef(null)
  const [rows, setRows]             = useState([])
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState(null)
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function excelDateToStr(val) {
    if (!val) return null
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000)
      return date.toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    if (!s) return null
    const m = s.match(/(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
    if (m) {
      const y = m[1].length === 2 ? `20${m[1]}` : m[1]
      return `${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
    }
    return null
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParseError('')
    setRows([])
    setResult(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim()))
      const parsed = dataRows.map((r, i) => ({
        _row:          i + 2,
        code:          String(r[0] ?? '').trim(),
        name:          String(r[1] ?? '').trim(),
        unit:          String(r[2] ?? '').trim() || 'BOX',
        barcode:       String(r[3] ?? '').trim() || null,
        client_name:   String(r[4] ?? '').trim() || null,
        expiry_at:     excelDateToStr(r[5]),
        mgmt_location: String(r[6] ?? '').trim() || null,
        box_qty:       r[7] ? Number(r[7]) || null : null,
        _valid:        !!(String(r[0] ?? '').trim() && String(r[1] ?? '').trim()),
      }))
      if (parsed.length === 0) { setParseError('데이터가 없습니다. 양식을 확인해주세요.'); return }
      setRows(parsed)
    } catch (err) {
      setParseError('파일을 읽는 중 오류가 발생했습니다: ' + err.message)
    }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['상품코드*', '상품명*', '단위', '바코드', '화주사명', '유통기한(YYYY-MM-DD)', '관리로케이션', 'BOX내품수'],
      ['PRD-001', '삼다수 2L 6입', 'BOX', '8801234567890', '(주)샘물', '2026-12-31', 'A-01', 24],
      ['PRD-002', '포카리스웨트 500ml', 'EA', '8801095814050', '(주)동아오츠카', '2026-06-30', 'B-02', 12],
    ])
    ws['!cols'] = [{ wch:14 },{ wch:24 },{ wch:8 },{ wch:16 },{ wch:18 },{ wch:22 },{ wch:14 },{ wch:10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '상품목록')
    XLSX.writeFile(wb, '상품등록양식.xlsx')
  }

  async function handleImport() {
    const validRows = rows.filter(r => r._valid)
    if (validRows.length === 0) return
    setImporting(true)
    let success = 0, skipped = 0
    const errors = []
    for (const row of validRows) {
      const { error } = await supabase.from('products').insert({
        code:          row.code,
        name:          row.name,
        unit:          row.unit,
        barcode:       row.barcode,
        client_name:   row.client_name,
        expiry_at:     row.expiry_at,
        mgmt_location: row.mgmt_location,
        box_qty:       row.box_qty,
      })
      if (!error)             success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setImporting(false)
    setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  const validCount   = rows.filter(r => r._valid).length
  const invalidCount = rows.filter(r => !r._valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-5xl shadow-2xl max-h-[90vh] flex flex-col"
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <h2 className="text-lg font-bold text-white">📊 엑셀 일괄등록</h2>
            <p className="text-xs text-slate-500 mt-1">양식을 다운로드해 작성 후 업로드하세요. 중복 상품코드는 자동 건너뜁니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-300 mb-1">① 양식 다운로드</p>
              <p className="text-xs text-gray-500">열 순서: 상품코드* / 상품명* / 단위 / 바코드 / 화주사명 / 유통기한 / 관리로케이션 / BOX내품수</p>
            </div>
            <button onClick={downloadTemplate}
              className="wms-btn wms-btn-ghost whitespace-nowrap">
              ⬇ 양식 다운로드
            </button>
          </div>

          <div className="border-t border-gray-800" />

          <div>
            <p className="text-sm font-semibold text-gray-300 mb-3">② 파일 업로드</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <p className="text-gray-400 text-sm">클릭하여 파일 선택 (.xlsx, .xls)</p>
              <p className="text-gray-600 text-xs mt-1">또는 파일을 이 영역으로 드래그</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
            {parseError && <p className="text-red-400 text-sm mt-2">{parseError}</p>}
          </div>

          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">③ 미리보기</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">유효 {validCount}건</span>
                  {invalidCount > 0 && <span className="text-red-400">필수값 누락 {invalidCount}건 (건너뜀)</span>}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-60">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr className="text-gray-400">
                      <th className="px-3 py-2 text-left font-medium w-10">행</th>
                      <th className="px-3 py-2 text-left font-medium">상품코드</th>
                      <th className="px-3 py-2 text-left font-medium">상품명</th>
                      <th className="px-3 py-2 text-left font-medium w-14">단위</th>
                      <th className="px-3 py-2 text-left font-medium">바코드</th>
                      <th className="px-3 py-2 text-left font-medium">화주사명</th>
                      <th className="px-3 py-2 text-left font-medium">유통기한</th>
                      <th className="px-3 py-2 text-left font-medium">관리로케이션</th>
                      <th className="px-3 py-2 text-right font-medium">BOX내품수</th>
                      <th className="px-3 py-2 text-center font-medium w-12">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rows.map(r => (
                      <tr key={r._row} className={r._valid ? 'hover:bg-gray-800/40' : 'bg-red-900/10'}>
                        <td className="px-3 py-2 text-gray-600">{r._row}</td>
                        <td className="px-3 py-2 font-mono text-gray-300">{r.code || <span className="text-red-400">없음</span>}</td>
                        <td className="px-3 py-2 text-white">{r.name || <span className="text-red-400">없음</span>}</td>
                        <td className="px-3 py-2 text-gray-400">{r.unit}</td>
                        <td className="px-3 py-2 text-gray-500">{r.barcode ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.client_name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.expiry_at ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.mgmt_location ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{r.box_qty ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {r._valid ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-gray-700 p-5 space-y-2">
              <p className="text-sm font-semibold text-white">등록 완료</p>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-emerald-400 font-bold">✓ 등록 성공 {result.success}건</span>
                {result.skipped > 0 && <span className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}건</span>}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-400 space-y-1">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 flex items-center justify-end gap-3" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <button onClick={onClose} className="wms-btn wms-btn-ghost">닫기</button>
          {rows.length > 0 && !result && (
            <button onClick={handleImport} disabled={importing || validCount === 0}
              className="wms-btn wms-btn-success">
              {importing ? '등록 중...' : `${validCount}건 등록`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 로케이션 팝업 */
function LocationModal({ product, locations, loading, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const totalQty = locations.reduce((s, it) => s + (it.qty ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col"
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between p-6" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500">{product.code}</span>
              {product.client_name && (
                <span className="wms-tag">{product.client_name}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{product.name}</h2>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <p className="text-sm text-gray-400">
                현재 적재 위치 · <span className="text-green-400 font-semibold">총 {totalQty.toLocaleString()} {product.unit}</span>
              </p>
              {product.mgmt_location && (
                <span className="text-xs text-[#F59E0B] font-mono bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-0.5 rounded">
                  {product.mgmt_location}
                </span>
              )}
              {product.box_qty && (
                <span className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 px-2 py-0.5 rounded">
                  {product.box_qty}개입
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : locations.length === 0 ? (
            <p className="text-center text-gray-600 py-8">현재 적재된 랙이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                  <th className="pb-2 font-medium w-8">#</th>
                  <th className="pb-2 font-medium">로케이션</th>
                  <th className="pb-2 font-medium text-center">단</th>
                  <th className="pb-2 font-medium text-center">좌/우</th>
                  <th className="pb-2 font-medium text-right">수량</th>
                  <th className="pb-2 font-medium text-right">입고일</th>
                  <th className="pb-2 font-medium text-right">유통기한</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {locations.map((it, idx) => {
                  const expiry   = it.pallets?.expiry_at ? new Date(it.pallets.expiry_at) : null
                  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / 86400000) : null
                  const isExpired      = daysLeft !== null && daysLeft <= 0
                  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
                  return (
                    <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 text-xs text-gray-600">{idx + 1}</td>
                      <td className="py-3">
                        {it.pallets?.locations?.code ? (
                          <span className="inline-block bg-[#F59E0B]/15 border border-[#F59E0B]/30
                                           text-[#F59E0B]/80 font-mono font-bold text-xs px-3 py-1 rounded-lg">
                            {it.pallets.locations.code}
                          </span>
                        ) : <span className="text-gray-600 text-xs">위치 없음</span>}
                      </td>
                      <td className="py-3 text-center text-gray-300 font-semibold">{it.pallets?.tier ?? '—'}단</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          it.pallets?.side === 'L'
                            ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                            : 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                        }`}>{it.pallets?.side === 'L' ? '좌' : '우'}</span>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-green-400">{(it.qty ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-right text-xs text-gray-500">
                        {it.pallets?.inbound_at ? new Date(it.pallets.inbound_at).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="py-3 text-right text-xs">
                        {expiry ? (
                          <span className={isExpired ? 'text-red-500 font-bold' : isExpiringSoon ? 'text-yellow-400 font-semibold' : 'text-gray-500'}>
                            {expiry.toLocaleDateString('ko-KR')}
                            {isExpired && ' ⚠'}{isExpiringSoon && ` D-${daysLeft}`}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {locations.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-700 text-xs text-gray-600">
            FIFO 순서 (위에서부터 먼저 출고)
          </div>
        )}
      </div>
    </div>
  )
}

function FieldInput({ label, value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <input
        type={type}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  )
}

const inputCls = 'wms-input'
