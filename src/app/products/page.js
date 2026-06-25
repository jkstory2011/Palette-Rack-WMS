'use client'

import { useEffect, useState, useCallback } from 'react'
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

  // 상품 클릭 → 로케이션 팝업
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
        <h2 className="text-base font-semibold text-gray-300">신규 상품 등록</h2>

        {/* 1행: 상품코드 / 상품명 / 바코드 / 단위 */}
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

        {/* 2행: 화주사명 / 유통취급기한 */}
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

        {/* 헤더 */}
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

        {/* 본문 */}
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
