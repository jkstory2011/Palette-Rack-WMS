'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import LabelPrinter from '@/components/LabelPrinter'

const TIERS = [4, 3, 2, 1]   // 위(4단) → 아래(1단) 순서로 표시
const SIDES = ['L', 'R']
const SIDE_KO = { L: '좌', R: '우' }

export default function RackModal({ location, onClose, onRefresh }) {
  const [pallets, setPallets]         = useState([])   // 이 로케이션의 stored 파렛트들
  const [printTarget, setPrintTarget] = useState(null) // 라벨 출력할 파렛트
  const [loading, setLoading]         = useState(true)

  const fetchPallets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pallets')
      .select(`
        id, code, tier, side, inbound_at, note,
        pallet_items (
          id, qty,
          products ( id, code, name, unit )
        )
      `)
      .eq('location_id', location.id)
      .eq('status', 'stored')

    setPallets(data ?? [])
    setLoading(false)
  }, [location.id])

  useEffect(() => {
    fetchPallets()
  }, [fetchPallets])

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // (tier, side) → pallet 빠른 조회
  const slotMap = new Map(pallets.map((p) => [`${p.tier}-${p.side}`, p]))

  // 요약 통계
  const usedCount  = pallets.length
  const mixedCount = pallets.filter((p) => (p.pallet_items?.length ?? 0) > 1).length

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${location.code} 랙 상세`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl
                        max-h-[92vh] overflow-y-auto shadow-2xl pointer-events-auto">

          {/* ── 헤더 */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700
                          flex items-center justify-between px-5 py-4 z-10 rounded-t-2xl">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">랙 {location.code}</h2>
                {location.aisle && (
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                    {location.aisle}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {usedCount}/8 슬롯 사용
                {mixedCount > 0 && (
                  <span className="ml-2 text-amber-400 font-semibold">
                    · 혼적 {mixedCount}건
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-700
                         rounded-lg w-9 h-9 flex items-center justify-center
                         text-xl transition-colors shrink-0"
            >
              ✕
            </button>
          </div>

          {/* ── 4단 슬롯 목록 */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-gray-400 animate-pulse">
                슬롯 정보 불러오는 중...
              </div>
            ) : (
              TIERS.map((tier) => (
                <TierRow
                  key={tier}
                  tier={tier}
                  slotMap={slotMap}
                  onPrint={setPrintTarget}
                />
              ))
            )}
          </div>

          {/* ── 하단 버튼 */}
          <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700
                          px-5 py-4 flex justify-end gap-3 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600
                         text-white font-medium transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 바코드 라벨 인쇄 */}
      {printTarget && (
        <LabelPrinter
          pallet={printTarget}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </>
  )
}

// ──────────────────────────────────────────
// 단(Tier) 한 행 — 좌(L) / 우(R) 슬롯 나란히
// ──────────────────────────────────────────
function TierRow({ tier, slotMap, onPrint }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 items-stretch">

      {/* 단 번호 배지 */}
      <div className="flex items-center justify-center">
        <div className="bg-gray-700 text-gray-300 rounded-xl
                        w-10 h-10 flex flex-col items-center justify-center
                        text-xs font-bold leading-tight shrink-0">
          <span>{tier}</span>
          <span className="text-[9px] font-normal opacity-60">단</span>
        </div>
      </div>

      {/* 좌 / 우 슬롯 */}
      {SIDES.map((side) => {
        const pallet = slotMap.get(`${tier}-${side}`)
        return (
          <SlotCell
            key={side}
            tier={tier}
            side={side}
            pallet={pallet}
            onPrint={onPrint}
          />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────
// 개별 슬롯 셀
// ──────────────────────────────────────────
function SlotCell({ tier, side, pallet, onPrint }) {
  const isEmpty  = !pallet
  const isMixed  = !isEmpty && (pallet.pallet_items?.length ?? 0) > 1
  const itemCount = pallet?.pallet_items?.length ?? 0

  // 상태별 테두리/배경 색
  const borderCls = isEmpty
    ? 'border-gray-700 bg-gray-800/40'
    : isMixed
      ? 'border-amber-600 bg-amber-900/20'
      : 'border-green-700 bg-green-900/15'

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[110px] ${borderCls}`}>

      {/* 슬롯 식별 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">
          {SIDE_KO[side]}측({side})
        </span>
        <StatusChip empty={isEmpty} mixed={isMixed} />
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-700 text-sm">—</span>
        </div>
      ) : (
        <>
          {/* 파렛트 코드 */}
          <p className="text-sm font-bold text-white font-mono tracking-tight truncate"
             title={pallet.code}>
            {pallet.code}
          </p>

          {/* 입고 일시 */}
          <p className="text-[11px] text-gray-500">
            입고 {formatDate(pallet.inbound_at)}
          </p>

          {/* 혼적 상품 목록 */}
          <ul className="space-y-1 flex-1">
            {pallet.pallet_items?.map((item) => (
              <li key={item.id}
                  className="flex items-baseline justify-between gap-1 text-xs">
                <span className="text-gray-300 truncate flex-1" title={item.products?.name}>
                  {item.products?.name}
                </span>
                <span className="text-gray-500 shrink-0 font-mono">
                  {item.qty}{item.products?.unit}
                </span>
              </li>
            ))}
          </ul>

          {/* 혼적 배지 */}
          {isMixed && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30
                               px-2 py-0.5 rounded-full font-semibold">
                혼적 {itemCount}종
              </span>
            </div>
          )}

          {/* 라벨 출력 버튼 */}
          <button
            onClick={() => onPrint(pallet)}
            className="mt-1 w-full py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600
                       text-white text-xs font-semibold transition-colors
                       flex items-center justify-center gap-1"
          >
            <span>🖨</span> 라벨 출력
          </button>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// 슬롯 상태 칩
// ──────────────────────────────────────────
function StatusChip({ empty, mixed }) {
  if (empty) {
    return (
      <span className="text-[10px] text-green-500 font-semibold">빈 슬롯</span>
    )
  }
  if (mixed) {
    return (
      <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5
                       rounded-full font-bold">혼적</span>
    )
  }
  return (
    <span className="text-[10px] text-gray-400 font-semibold">입고됨</span>
  )
}

// 날짜 포맷
function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
