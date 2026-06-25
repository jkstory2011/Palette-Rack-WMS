'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const EMPTY_FORM = { code: '', name: '', unit: 'BOX', barcode: '', client_name: '', expiry_at: '' }

export default function ProductsPage() {
  const [products, setProducts]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [form, setForm]                       = useState(EMPTY_FORM)
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState('')
  const [search, setSearch]                   = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [rackLocations, setRackLocations]     = useState([])
  const [loadingModal, setLoadingModal]       = useState(false)
  const [showExcelModal, setShowExcelModal]   = useState(false)

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select(`
        id, code, name, unit, barcode, client_name, expiry_at, created_at,
        pallet_items (
          qty,
          pallets ( status, location_id, inbound_at )
        )
      `)
      .order('created_at', { ascending: false })

    const enriched = (data ?? []).map((p) => {
      const stored = (p.pallet_items ?? []).filter((it) => it.pallets?.status === 'stored')
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

  const closeModal = useCallback(() => setSelectedProduct(null), [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim() || !form.name.trim()) {
      setError('상품코드와 상품명은 필수입니다.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('products').insert({
      code:        form.code.trim(),
      name:        form.name.trim(),
      unit:        form.unit.trim() || 'EA',
      barcode:     form.barcode.trim()     || null,
      client_name: form.client_name.trim() || null,
      expiry_at:   form.expiry_at          || null,
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

  const filtered = products.filter((p) =>
    p.name.includes(search) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? '').includes(search) ||
    (p.client_name ?? '').includes(search),
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">상품 마스터</h1>

      {/* ── 등록 폼 */}
      <form onSubmit={handleSubmit} className="wms-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-300">신규 상품 등록</h2>
          <button
            type="button"
            onClick={() => setShowExcelModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600
                       text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            📊 엑셀 일괄등록
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FieldInput label="상품코드 *" placeholder="PRD-001"
            value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))} />
          <FieldInput label="상품명 *" placeholder="삼다수 2L 6입"
            value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <FieldInput label="바코드" placeholder="8801234567890"
            value={form.barcode} onChange={(v) => setForm((f) => ({ ...f, barcode: v }))} />
          <FieldInput label="단위" placeholder="BOX / EA / SET"
            value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput label="화주사명" placeholder="(주)OO물류"
            value={form.client_name} onChange={(v) => setForm((f) => ({ ...f, client_name: v }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-400">유통/취급기한</label>
            <input
              type="date"
              value={form.expiry_at}
              onChange={(e) => setForm((f) => ({ ...f, expiry_at: e.target.value }))}
              className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-semibold transition-colors disabled:opacity-40">
          {saving ? '등록 중...' : '+ 상품 등록'}
        </button>
      </form>

      {/* ── 검색 + 목록 */}
      <div className="wms-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-300">
            전체 상품 <span className="text-gray-500 font-normal">({products.length}종)</span>
          </h2>
          <input
            type="search"
            placeholder="코드, 이름, 바코드, 화주사 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-2
                       text-white text-sm placeholder-gray-500 focus:outline-none
                       focus:ring-2 focus:ring-blue-500/50 w-64"
          />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-8">등록된 상품이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                  <th className="pb-2 font-medium pr-4 w-28">상품코드</th>
                  <th className="pb-2 font-medium pr-4">상품명</th>
                  <th className="pb-2 font-medium pr-4 w-32">화주사명</th>
                  <th className="pb-2 font-medium pr-4 w-32">바코드</th>
                  <th className="pb-2 font-medium pr-4 w-24">입고일</th>
                  <th className="pb-2 font-medium pr-4 w-28">유통/취급기한</th>
                  <th className="pb-2 font-medium text-right pr-4 w-24">전체재고수량</th>
                  <th className="pb-2 font-medium text-right pr-4 w-24">현적재수량</th>
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((p) => {
                  const now      = new Date()
                  const expiry   = p.expiry_at ? new Date(p.expiry_at) : null
                  const daysLeft = expiry ? Math.ceil((expiry - now) / 86400000) : null
                  const isExpired      = daysLeft !== null && daysLeft <= 0
                  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30

                  return (
                    <tr key={p.id} onClick={() => openModal(p)}
                      className="hover:bg-gray-800/60 transition-colors cursor-pointer">
                      <td className="py-3 font-mono text-gray-300 pr-4 text-xs">{p.code}</td>
                      <td className="py-3 pr-4">
                        <span className="text-white font-medium">{p.name}</span>
                        <span className="text-gray-600 text-xs ml-2">{p.unit}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-400">
                        {p.client_name ?? <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-3 font-mono text-gray-400 pr-4 text-xs">
                        {p.barcode ?? <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-3 text-gray-400 text-xs pr-4">
                        {p.lastInbound
                          ? new Date(p.lastInbound).toLocaleDateString('ko-KR')
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-3 text-xs pr-4">
                        {expiry ? (
                          <span className={
                            isExpired ? 'text-red-500 font-bold'
                            : isExpiringSoon ? 'text-yellow-400 font-semibold'
                            : 'text-gray-400'
                          }>
                            {expiry.toLocaleDateString('ko-KR')}
                            {isExpired      && ' ⚠'}
                            {isExpiringSoon && ` (D-${daysLeft})`}
                          </span>
                        ) : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-3 text-right font-mono text-gray-300 pr-4">
                        {p.totalQty > 0 ? p.totalQty.toLocaleString() : <span className="text-gray-700">0</span>}
                      </td>
                      <td className="py-3 text-right font-mono pr-4">
                        <span className={p.storedQty > 0 ? 'text-green-400 font-semibold' : 'text-gray-600'}>
                          {p.storedQty.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1"
                        >삭제</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 로케이션 팝업 */}
      {selectedProduct && (
        <LocationModal
          product={selectedProduct}
          locations={rackLocations}
          loading={loadingModal}
          onClose={closeModal}
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
  const fileRef   = useRef(null)
  const [rows, setRows]         = useState([])     // 파싱된 미리보기 행
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState(null)   // { success, skipped, errors }
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // 엑셀 날짜 시리얼 → YYYY-MM-DD
  function excelDateToStr(val) {
    if (!val) return null
    if (typeof val === 'number') {
      // Excel 날짜 시리얼 변환
      const date = new Date((val - 25569) * 86400 * 1000)
      return date.toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    if (!s) return null
    // YYYY-MM-DD / YYYY/MM/DD / YY-MM-DD 등 처리
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

      // 첫 행 = 헤더, 나머지 = 데이터
      const dataRows = raw.slice(1).filter((r) => r.some((c) => String(c).trim()))

      const parsed = dataRows.map((r, i) => ({
        _row: i + 2,
        code:        String(r[0] ?? '').trim(),
        name:        String(r[1] ?? '').trim(),
        unit:        String(r[2] ?? '').trim() || 'BOX',
        barcode:     String(r[3] ?? '').trim() || null,
        client_name: String(r[4] ?? '').trim() || null,
        expiry_at:   excelDateToStr(r[5]),
        _valid:      !!(String(r[0] ?? '').trim() && String(r[1] ?? '').trim()),
      }))

      if (parsed.length === 0) {
        setParseError('데이터가 없습니다. 양식을 확인해주세요.')
        return
      }
      setRows(parsed)
    } catch (err) {
      setParseError('파일을 읽는 중 오류가 발생했습니다: ' + err.message)
    }
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['상품코드*', '상품명*', '단위', '바코드', '화주사명', '유통/취급기한(YYYY-MM-DD)'],
      ['PRD-001', '삼다수 2L 6입', 'BOX', '8801234567890', '(주)샘물', '2026-12-31'],
      ['PRD-002', '포카리스웨트 500ml', 'EA', '8801095814050', '(주)동아오츠카', '2026-06-30'],
    ])
    // 열 너비 설정
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '상품목록')
    XLSX.writeFile(wb, '상품등록양식.xlsx')
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r._valid)
    if (validRows.length === 0) return

    setImporting(true)
    let success = 0
    let skipped = 0
    const errors = []

    for (const row of validRows) {
      const { error } = await supabase.from('products').insert({
        code:        row.code,
        name:        row.name,
        unit:        row.unit,
        barcode:     row.barcode,
        client_name: row.client_name,
        expiry_at:   row.expiry_at,
      })
      if (!error) {
        success++
      } else if (error.code === '23505') {
        skipped++
      } else {
        errors.push(`${row.code}: ${error.message}`)
      }
    }

    setImporting(false)
    setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  const validCount   = rows.filter((r) => r._valid).length
  const invalidCount = rows.filter((r) => !r._valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl
                      shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">📊 엑셀 일괄등록</h2>
            <p className="text-xs text-gray-500 mt-1">
              엑셀 양식을 다운로드해 작성 후 업로드하세요. 중복 상품코드는 자동 건너뜁니다.
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-2xl leading-none ml-4">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Step 1: 양식 다운로드 */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-300 mb-1">① 양식 다운로드</p>
              <p className="text-xs text-gray-500">
                열 순서: 상품코드* / 상품명* / 단위 / 바코드 / 화주사명 / 유통기한
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600
                         text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              ⬇ 양식 다운로드
            </button>
          </div>

          <div className="border-t border-gray-800" />

          {/* Step 2: 파일 업로드 */}
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-3">② 파일 업로드</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-emerald-500
                         rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <p className="text-gray-400 text-sm">
                클릭하여 파일 선택 (.xlsx, .xls)
              </p>
              <p className="text-gray-600 text-xs mt-1">또는 파일을 이 영역으로 드래그</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            {parseError && <p className="text-red-400 text-sm mt-2">{parseError}</p>}
          </div>

          {/* Step 3: 미리보기 */}
          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">③ 미리보기</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">유효 {validCount}건</span>
                  {invalidCount > 0 && (
                    <span className="text-red-400">필수값 누락 {invalidCount}건 (건너뜀)</span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-60">
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr className="text-gray-400">
                      <th className="px-3 py-2 text-left font-medium w-10">행</th>
                      <th className="px-3 py-2 text-left font-medium">상품코드</th>
                      <th className="px-3 py-2 text-left font-medium">상품명</th>
                      <th className="px-3 py-2 text-left font-medium w-16">단위</th>
                      <th className="px-3 py-2 text-left font-medium">바코드</th>
                      <th className="px-3 py-2 text-left font-medium">화주사명</th>
                      <th className="px-3 py-2 text-left font-medium">유통기한</th>
                      <th className="px-3 py-2 text-center font-medium w-14">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rows.map((r) => (
                      <tr key={r._row}
                        className={r._valid ? 'hover:bg-gray-800/40' : 'bg-red-900/10'}>
                        <td className="px-3 py-2 text-gray-600">{r._row}</td>
                        <td className="px-3 py-2 font-mono text-gray-300">{r.code || <span className="text-red-400">없음</span>}</td>
                        <td className="px-3 py-2 text-white">{r.name || <span className="text-red-400">없음</span>}</td>
                        <td className="px-3 py-2 text-gray-400">{r.unit}</td>
                        <td className="px-3 py-2 text-gray-500">{r.barcode ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.client_name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.expiry_at ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {r._valid
                            ? <span className="text-emerald-400">✓</span>
                            : <span className="text-red-400">✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div className="rounded-xl border border-gray-700 p-5 space-y-2">
              <p className="text-sm font-semibold text-white">등록 완료</p>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-emerald-400 font-bold">✓ 등록 성공 {result.success}건</span>
                {result.skipped > 0 && (
                  <span className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}건</span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-400 space-y-1">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600
                       text-white text-sm font-semibold transition-colors">
            닫기
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                         disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {importing ? '등록 중...' : `📥 ${validCount}건 등록`}
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
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const totalQty = locations.reduce((s, it) => s + (it.qty ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl
                      shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-500">{product.code}</span>
              {product.client_name && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                  {product.client_name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{product.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              현재 적재 위치 ·{' '}
              <span className="text-green-400 font-semibold">
                총 {totalQty.toLocaleString()} {product.unit}
              </span>
            </p>
            {product.expiry_at && (
              <p className="text-xs text-gray-500 mt-0.5">
                유통기한: {new Date(product.expiry_at).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-2xl leading-none ml-4">
            ✕
          </button>
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
                          <span className="inline-block bg-blue-600/20 border border-blue-500/30
                                           text-blue-300 font-mono font-bold text-xs px-3 py-1 rounded-lg">
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
                      <td className="py-3 text-right font-mono font-bold text-green-400">
                        {(it.qty ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-xs text-gray-500">
                        {it.pallets?.inbound_at
                          ? new Date(it.pallets.inbound_at).toLocaleDateString('ko-KR') : '—'}
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

function FieldInput({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <input
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                   text-white placeholder-gray-600 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
      />
    </div>
  )
}
