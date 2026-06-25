'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFifoLocations, pickFifoItems } from '@/lib/utils/fifo'

const SIDE_KO = { L: '좌(L)', R: '우(R)' }

export default function OutboundPage() {
  const [products, setProducts]   = useState([])
  const [entries, setEntries]     = useState([])   // 추가된 상품별 출고 항목
  const [addProductId, setAddProductId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  useEffect(() => {
    supabase.from('products').select('id, code, name, unit').order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  const addedProductIds = entries.map((e) => String(e.productId))

  // ── 상품 추가
  async function handleAddProduct() {
    if (!addProductId || addedProductIds.includes(String(addProductId))) return
    const product = products.find((p) => String(p.id) === String(addProductId))
    const entryId = Date.now()

    setEntries((prev) => [...prev, {
      id: entryId, productId: addProductId, product,
      fifoList: [], rowPicks: {}, liveQty: '', loading: true,
    }])
    setAddProductId('')

    try {
      const fifoList = await getFifoLocations(supabase, Number(addProductId))
      const rowPicks = {}
      fifoList.forEach((item) => { rowPicks[item.palletId] = { checked: false, shipQty: item.qty } })
      setEntries((prev) => prev.map((e) =>
        e.id === entryId ? { ...e, fifoList, rowPicks, loading: false } : e
      ))
    } catch (err) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
      setError(err.message)
    }
  }

  // ── 상품 제거
  function removeEntry(entryId) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  // ── 수량 입력 → FIFO 자동 선택
  function updateLiveQty(entryId, qty) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      const qtyNum = Number(qty)
      if (!qty || qtyNum <= 0) {
        const rowPicks = {}
        e.fifoList.forEach((item) => {
          rowPicks[item.palletId] = { checked: false, shipQty: e.rowPicks[item.palletId]?.shipQty ?? item.qty }
        })
        return { ...e, liveQty: qty, rowPicks }
      }
      const result = pickFifoItems(e.fifoList, qtyNum)
      const rowPicks = {}
      e.fifoList.forEach((item) => {
        const p = result.items.find((r) => r.palletId === item.palletId)
        rowPicks[item.palletId] = { checked: !!p, shipQty: p?.shipQty ?? item.qty }
      })
      return { ...e, liveQty: qty, rowPicks }
    }))
  }

  // ── 행 체크박스 토글
  function toggleRow(entryId, palletId) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      return {
        ...e, liveQty: '',
        rowPicks: { ...e.rowPicks, [palletId]: { ...e.rowPicks[palletId], checked: !e.rowPicks[palletId]?.checked } },
      }
    }))
  }

  // ── 행 수량 직접 수정
  function updateRowQty(entryId, palletId, val, maxQty) {
    const shipQty = Math.min(Math.max(1, Number(val) || 1), maxQty)
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      return { ...e, liveQty: '', rowPicks: { ...e.rowPicks, [palletId]: { checked: true, shipQty } } }
    }))
  }

  // ── 전체 체크/해제
  function toggleAllRows(entryId, checked) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e
      const rowPicks = {}
      e.fifoList.forEach((item) => { rowPicks[item.palletId] = { ...e.rowPicks[item.palletId], checked } })
      return { ...e, liveQty: '', rowPicks }
    }))
  }

  // ── 항목별 선택 계산
  function getSelectedItems(entry) {
    return entry.fifoList
      .filter((item) => entry.rowPicks[item.palletId]?.checked)
      .map((item) => {
        const shipQty = entry.rowPicks[item.palletId]?.shipQty ?? item.qty
        return { ...item, shipQty, isPartial: shipQty < item.qty }
      })
  }

  const entriesWithSelection = entries.map((e) => ({ ...e, selectedItems: getSelectedItems(e) }))
  const hasAnySelection = entriesWithSelection.some((e) => e.selectedItems.length > 0)

  // ── 출고 확정
  async function handleConfirm() {
    if (!hasAnySelection) return
    setConfirming(true)
    setError('')
    try {
      for (const entry of entriesWithSelection) {
        for (const item of entry.selectedItems) {
          const { shipQty } = item
          if (shipQty < item.qty) {
            const { error: uErr } = await supabase
              .from('pallet_items')
              .update({ qty: item.qty - shipQty })
              .eq('pallet_id', item.palletId)
              .eq('product_id', Number(entry.productId))
            if (uErr) throw uErr
          } else {
            const { error: dErr } = await supabase
              .from('pallet_items')
              .delete()
              .eq('pallet_id', item.palletId)
              .eq('product_id', Number(entry.productId))
            if (dErr) throw dErr

            const { data: remaining } = await supabase
              .from('pallet_items').select('id').eq('pallet_id', item.palletId)
            if (!remaining || remaining.length === 0) {
              const { error: pErr } = await supabase
                .from('pallets')
                .update({ status: 'shipped', outbound_at: new Date().toISOString() })
                .eq('id', item.palletId)
              if (pErr) throw pErr
            }
          }
          await supabase.from('outbound_logs').insert({
            pallet_id:   item.palletId,
            location_id: item.locationId,
            tier:        item.tier,
            side:        item.side,
          })
        }
      }

      const summary = entriesWithSelection
        .filter((e) => e.selectedItems.length > 0)
        .map((e) => `${e.product?.name} ${e.selectedItems.reduce((s, i) => s + i.shipQty, 0).toLocaleString()}${e.product?.unit}`)
        .join(' / ')

      setSuccess(`✅ 출고 완료 — ${summary}`)
      setEntries([])
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">출고 지시 — FIFO</h1>

      {/* ── 상품 추가 */}
      <div className="wms-card space-y-3">
        <h2 className="text-base font-semibold text-gray-300">출고 상품 추가</h2>
        <div className="flex gap-3">
          <select
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                       text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">상품 선택...</option>
            {products
              .filter((p) => !addedProductIds.includes(String(p.id)))
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
          </select>
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={!addProductId}
            className="shrink-0 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                       text-white font-bold transition-colors disabled:opacity-40"
          >
            + 추가
          </button>
        </div>
        {entries.length > 0 && (
          <p className="text-xs text-gray-600">
            {entries.length}개 상품 추가됨 — 다른 상품을 계속 추가할 수 있습니다.
          </p>
        )}
      </div>

      {/* ── 피드백 */}
      {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

      {/* ── 상품별 FIFO 카드 */}
      {entries.map((entry) => {
        const totalStock    = entry.fifoList.reduce((s, i) => s + i.qty, 0)
        const selectedItems = getSelectedItems(entry)
        const totalSelected = selectedItems.reduce((s, i) => s + i.shipQty, 0)
        const allChecked    = entry.fifoList.length > 0 && entry.fifoList.every((i) => entry.rowPicks[i.palletId]?.checked)

        return (
          <div key={entry.id} className="wms-card space-y-4">
            {/* 상품 헤더 */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-gray-500">{entry.product?.code}</span>
                  {totalSelected > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full
                                     bg-blue-900/40 text-blue-300 border border-blue-700">
                      선택: {totalSelected.toLocaleString()} {entry.product?.unit}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">{entry.product?.name}</h3>
                {!entry.loading && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    총 재고: {entry.fifoList.length}파렛트 / {totalStock.toLocaleString()} {entry.product?.unit}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeEntry(entry.id)}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0 px-2 py-1"
              >
                ✕ 제거
              </button>
            </div>

            {entry.loading ? (
              <p className="text-center text-gray-500 py-4 animate-pulse text-sm">재고 조회 중...</p>
            ) : entry.fifoList.length === 0 ? (
              <p className="text-center text-gray-600 py-4 text-sm">해당 상품의 재고가 없습니다.</p>
            ) : (
              <>
                {/* 수량 자동 선택 */}
                <div className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
                  <span className="text-xs text-gray-400 shrink-0">출고수량</span>
                  <input
                    type="number"
                    min="1"
                    max={totalStock}
                    placeholder={`최대 ${totalStock.toLocaleString()}`}
                    value={entry.liveQty}
                    onChange={(e) => updateLiveQty(entry.id, e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5
                               text-white text-sm placeholder-gray-500 focus:outline-none
                               focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 shrink-0">{entry.product?.unit}</span>
                  {entry.liveQty && (
                    <button
                      onClick={() => updateLiveQty(entry.id, '')}
                      className="text-xs text-gray-600 hover:text-white transition-colors shrink-0"
                    >
                      초기화
                    </button>
                  )}
                </div>

                {/* FIFO 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-700 text-left">
                        <th className="pb-2 w-8">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={(e) => toggleAllRows(entry.id, e.target.checked)}
                            className="w-4 h-4 accent-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="pb-2 font-medium w-8">순위</th>
                        <th className="pb-2 font-medium">로케이션</th>
                        <th className="pb-2 font-medium text-center">슬롯</th>
                        <th className="pb-2 font-medium text-right">보유수량</th>
                        <th className="pb-2 font-medium text-right text-blue-400">출고수량</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {entry.fifoList.map((item) => {
                        const pick      = entry.rowPicks[item.palletId]
                        const checked   = pick?.checked ?? false
                        const shipQty   = pick?.shipQty ?? item.qty
                        const isPartial = shipQty < item.qty

                        return (
                          <tr
                            key={item.palletId}
                            onClick={() => toggleRow(entry.id, item.palletId)}
                            className={`transition-colors cursor-pointer ${
                              checked
                                ? 'bg-blue-900/20 border-l-2 border-blue-500'
                                : 'hover:bg-gray-800/40 opacity-50'
                            }`}
                          >
                            <td className="py-2.5 pl-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleRow(entry.id, item.palletId)}
                                className="w-4 h-4 accent-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5">
                              <span className={`inline-flex w-6 h-6 rounded-full items-center
                                               justify-center text-xs font-black ${
                                checked ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                              }`}>{item.rank}</span>
                            </td>
                            <td className="py-2.5">
                              <span className="font-bold text-white">{item.locationCode}</span>
                              <span className="text-xs text-gray-500 ml-1.5">{item.zoneCode}구역</span>
                              <div className="text-xs text-gray-600 font-mono">{item.palletCode}</div>
                            </td>
                            <td className="py-2.5 text-center">
                              <span className="text-gray-300 font-mono text-xs bg-gray-700 px-2 py-0.5 rounded-lg">
                                {item.tier}단 {SIDE_KO[item.side]}
                              </span>
                              {item.isMixed && (
                                <div className="mt-0.5">
                                  <span className="text-[10px] bg-amber-500 text-white
                                                   px-1.5 py-0.5 rounded-full font-bold">혼적</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <span className="font-bold text-white">{item.qty.toLocaleString()}</span>
                              <span className="text-gray-500 text-xs ml-1">{entry.product?.unit}</span>
                              <div className="text-xs text-gray-600">
                                {new Date(item.inboundAt).toLocaleDateString('ko-KR')}
                              </div>
                            </td>
                            <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              {checked ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.qty}
                                    value={shipQty}
                                    onChange={(e) => updateRowQty(entry.id, item.palletId, e.target.value, item.qty)}
                                    className="w-20 bg-gray-700 border border-blue-500/50 rounded-lg
                                               px-2 py-1 text-white text-sm text-right
                                               focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  {isPartial && (
                                    <span className="text-xs text-yellow-400">
                                      잔량 {(item.qty - shipQty).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-700 text-xs">—</span>
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
        )
      })}

      {/* ── 출고 요약 + 확정 */}
      {entries.length > 0 && (
        <div className="wms-card space-y-4">
          <h2 className="text-base font-semibold text-gray-300">출고 요약</h2>

          {!hasAnySelection ? (
            <p className="text-sm text-gray-600">
              각 상품에서 파렛트를 체크하거나 출고수량을 입력하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {entriesWithSelection
                .filter((e) => e.selectedItems.length > 0)
                .map((e) => {
                  const total   = e.selectedItems.reduce((s, i) => s + i.shipQty, 0)
                  const partial = e.selectedItems.filter((i) => i.isPartial).length
                  return (
                    <div key={e.id} className="flex items-center justify-between
                                               bg-gray-800/50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{e.product?.name}</p>
                        <p className="text-xs text-gray-500">
                          {e.selectedItems.length}파렛트
                          {partial > 0 && ` · 부분출고 ${partial}건 (잔량 유지)`}
                        </p>
                      </div>
                      <span className="text-blue-300 font-bold text-base">
                        {total.toLocaleString()} <span className="text-xs font-normal">{e.product?.unit}</span>
                      </span>
                    </div>
                  )
                })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-700">
            <button
              onClick={handleConfirm}
              disabled={confirming || !hasAnySelection}
              className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500
                         text-white font-bold transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {confirming
                ? '처리 중...'
                : !hasAnySelection
                  ? '🚛 출고 확정'
                  : `🚛 ${entriesWithSelection.filter((e) => e.selectedItems.length > 0).length}개 상품 출고 확정`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
