'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFifoLocations, pickFifoItems } from '@/lib/utils/fifo'

const SIDE_KO = { L: '좌(L)', R: '우(R)' }

export default function OutboundPage() {
  const [products, setProducts]     = useState([])
  const [productId, setProductId]   = useState('')
  const [neededQty, setNeededQty]   = useState('')
  const [fifoList, setFifoList]     = useState([])   // 전체 FIFO 재고 목록
  const [picked, setPicked]         = useState(null) // pickFifoItems 결과
  const [searching, setSearching]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  useEffect(() => {
    supabase
      .from('products')
      .select('id, code, name, unit')
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  // ── 재고 조회 (FIFO)
  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPicked(null)

    if (!productId) return setError('상품을 선택하세요.')

    setSearching(true)
    try {
      const list = await getFifoLocations(supabase, Number(productId))
      setFifoList(list)

      if (list.length === 0) {
        setError('해당 상품의 재고가 없습니다.')
      } else if (neededQty && Number(neededQty) > 0) {
        setPicked(pickFifoItems(list, Number(neededQty)))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  // ── 출고 확정 처리
  async function handleConfirm() {
    const targets = picked ? picked.items : fifoList
    if (targets.length === 0) return

    setConfirming(true)
    setError('')
    try {
      for (const item of targets) {
        // 1) 파렛트 상태 → 'shipped'
        const { error: pErr } = await supabase
          .from('pallets')
          .update({ status: 'shipped', outbound_at: new Date().toISOString() })
          .eq('id', item.palletId)

        if (pErr) throw pErr

        // 2) 출고 이력 기록 — pallets UPDATE 전에 location_id를 item에서 스냅샷
        await supabase.from('outbound_logs').insert({
          pallet_id:   item.palletId,
          location_id: item.locationId,  // SET NULL 되기 전 스냅샷
          tier:        item.tier,
          side:        item.side,
        })
      }

      setSuccess(`✅ ${targets.length}개 파렛트 출고 처리 완료`)
      setFifoList([])
      setPicked(null)
      setProductId('')
      setNeededQty('')
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  const selectedProduct = products.find((p) => String(p.id) === String(productId))
  const totalStock = fifoList.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">출고 지시 — FIFO</h1>

      {/* ── 검색 폼 */}
      <form onSubmit={handleSearch} className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">출고 상품 검색</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>상품</label>
            <select
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setFifoList([]); setPicked(null) }}
              className={selectCls}
            >
              <option value="">상품 선택...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              출고 수량
              {selectedProduct && <span className="text-gray-600 ml-1">({selectedProduct.unit})</span>}
            </label>
            <input
              type="number"
              min="1"
              placeholder="비우면 전체 조회"
              value={neededQty}
              onChange={(e) => setNeededQty(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={searching}
          className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                     text-white font-bold transition-colors disabled:opacity-40"
        >
          {searching ? '조회 중...' : '🔍 FIFO 재고 조회'}
        </button>
      </form>

      {/* ── 피드백 */}
      {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-700 rounded-xl px-4 py-3">{success}</p>}

      {/* ── FIFO 재고 목록 */}
      {fifoList.length > 0 && (
        <div className="wms-card space-y-4">

          {/* 헤더 요약 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                {selectedProduct?.name} — FIFO 출고 순서
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                총 재고: {fifoList.length}파렛트 / {totalStock.toLocaleString()} {selectedProduct?.unit}
              </p>
            </div>

            {/* 수량 충족 여부 배지 */}
            {picked && (
              <div className={`text-sm font-semibold px-4 py-2 rounded-xl ${
                picked.fulfilled
                  ? 'bg-green-900/30 text-green-400 border border-green-700'
                  : 'bg-red-900/30 text-red-400 border border-red-700'
              }`}>
                {picked.fulfilled
                  ? `✅ ${picked.totalQty.toLocaleString()} ${selectedProduct?.unit} 출고 가능`
                  : `⚠️ 재고 부족 (${picked.totalQty.toLocaleString()} ${selectedProduct?.unit} 확보 가능)`}
              </div>
            )}
          </div>

          {/* FIFO 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700 text-left">
                  <th className="pb-2 font-medium w-10">순위</th>
                  <th className="pb-2 font-medium">로케이션</th>
                  <th className="pb-2 font-medium text-center">슬롯</th>
                  <th className="pb-2 font-medium">파렛트 코드</th>
                  <th className="pb-2 font-medium text-right">수량</th>
                  <th className="pb-2 font-medium text-center">혼적</th>
                  <th className="pb-2 font-medium text-right">입고일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {fifoList.map((item) => {
                  // picked가 있으면 해당 항목 하이라이트
                  const isTarget = picked?.items.some((p) => p.palletId === item.palletId)
                  return (
                    <tr
                      key={item.palletId}
                      className={`transition-colors ${
                        isTarget
                          ? 'bg-blue-900/20 border-l-2 border-blue-500'
                          : 'hover:bg-gray-800/50'
                      }`}
                    >
                      {/* 순위 */}
                      <td className="py-3 pl-2">
                        <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center
                                          text-xs font-black ${
                          isTarget ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {item.rank}
                        </span>
                      </td>

                      {/* 로케이션 */}
                      <td className="py-3">
                        <span className="font-bold text-white">{item.locationCode}</span>
                        <span className="text-xs text-gray-500 ml-2">{item.zoneCode}구역</span>
                      </td>

                      {/* 슬롯 */}
                      <td className="py-3 text-center">
                        <span className="text-gray-300 font-mono text-xs bg-gray-700
                                         px-2 py-1 rounded-lg">
                          {item.tier}단 {SIDE_KO[item.side]}
                        </span>
                      </td>

                      {/* 파렛트 코드 */}
                      <td className="py-3 font-mono text-xs text-gray-400">
                        {item.palletCode}
                      </td>

                      {/* 수량 */}
                      <td className="py-3 text-right font-bold text-white">
                        {item.qty.toLocaleString()}
                        <span className="text-gray-500 font-normal ml-1 text-xs">
                          {selectedProduct?.unit}
                        </span>
                      </td>

                      {/* 혼적 여부 */}
                      <td className="py-3 text-center">
                        {item.isMixed ? (
                          <span className="text-[10px] bg-amber-500 text-white
                                           px-1.5 py-0.5 rounded-full font-bold">혼적</span>
                        ) : (
                          <span className="text-gray-700 text-xs">—</span>
                        )}
                      </td>

                      {/* 입고일시 */}
                      <td className="py-3 text-right text-xs text-gray-500">
                        {new Date(item.inboundAt).toLocaleString('ko-KR', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── 출고 확정 버튼 */}
          <div className="flex flex-col sm:flex-row items-center justify-between
                          gap-3 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              {picked
                ? `위 ${picked.items.length}개 파렛트를 출고 처리합니다.`
                : `위 ${fifoList.length}개 파렛트 전체를 출고 처리합니다.`}
            </p>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-red-600 hover:bg-red-500
                         text-white font-bold transition-colors disabled:opacity-40"
            >
              {confirming ? '처리 중...' : '🚛 출고 확정'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelCls  = 'block text-xs font-medium text-gray-400 mb-1'
const inputCls  = `w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                   text-white text-sm placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500`
const selectCls = `w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                   text-white text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500`
