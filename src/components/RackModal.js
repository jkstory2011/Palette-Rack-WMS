'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import LabelPrinter from '@/components/LabelPrinter'

const TIERS   = [4, 3, 2, 1]
const SIDES   = ['L', 'R']
const SIDE_KO = { L: '좌', R: '우' }

const SLOT_CONFIG_OPTIONS = [
  { value: 'both',  label: '좌/우 모두 사용',  desc: '기본 (8슬롯)' },
  { value: 'L',     label: '좌측만 사용',       desc: '우측 사용불가 (4슬롯)' },
  { value: 'R',     label: '우측만 사용',       desc: '좌측 사용불가 (4슬롯)' },
]

function availableSides(slot_config) {
  if (slot_config === 'L') return ['L']
  if (slot_config === 'R') return ['R']
  return ['L', 'R']
}

export default function RackModal({ location, onClose, onRefresh }) {
  const [pallets, setPallets]         = useState([])
  const [printTarget, setPrintTarget] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [slotConfig, setSlotConfig]   = useState(location.slot_config || 'both')
  const [configSaving, setConfigSaving] = useState(false)
  const [showConfig, setShowConfig]   = useState(false)

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

  useEffect(() => { fetchPallets() }, [fetchPallets])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveSlotConfig(newConfig) {
    setConfigSaving(true)
    await supabase.from('locations').update({ slot_config: newConfig }).eq('id', location.id)
    setSlotConfig(newConfig)
    setConfigSaving(false)
    setShowConfig(false)
    onRefresh?.()
  }

  const slotMap    = new Map(pallets.map((p) => [`${p.tier}-${p.side}`, p]))
  const activeSides = availableSides(slotConfig)
  const capacity   = activeSides.length * 4
  const usedCount  = pallets.length
  const mixedCount = pallets.filter((p) => (p.pallet_items?.length ?? 0) > 1).length

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`${location.code} 랙 상세`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
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
                {/* 슬롯 설정 배지 */}
                {slotConfig !== 'both' && (
                  <span className="text-xs bg-red-900/40 border border-red-700/50 text-red-400
                                   px-2 py-1 rounded-full font-semibold">
                    {slotConfig === 'L' ? '우측 사용불가' : '좌측 사용불가'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {usedCount}/{capacity} 슬롯 사용
                {mixedCount > 0 && (
                  <span className="ml-2 text-amber-400 font-semibold">· 혼적 {mixedCount}건</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 슬롯 설정 토글 버튼 */}
              <button onClick={() => setShowConfig(v => !v)}
                title="슬롯 사용 설정"
                className={`rounded-lg w-9 h-9 flex items-center justify-center text-sm transition-colors
                  ${showConfig ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                ⚙
              </button>
              <button onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-gray-700
                           rounded-lg w-9 h-9 flex items-center justify-center text-xl transition-colors shrink-0">
                ✕
              </button>
            </div>
          </div>

          {/* ── 슬롯 설정 패널 */}
          {showConfig && (
            <div className="border-b border-gray-700 px-5 py-4 bg-gray-800/50">
              <p className="text-xs font-semibold text-amber-400 mb-3 tracking-widest uppercase">슬롯 사용 설정</p>
              <div className="flex flex-col gap-2">
                {SLOT_CONFIG_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => saveSlotConfig(opt.value)}
                    disabled={configSaving}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left
                      ${slotConfig === opt.value
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                        : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}>
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-xs opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                설치 문제 등으로 한쪽만 사용하는 랙에 적용하세요. 사용불가 슬롯은 입고 배정에서 제외됩니다.
              </p>
            </div>
          )}

          {/* ── 4단 슬롯 목록 */}
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-gray-400 animate-pulse">슬롯 정보 불러오는 중...</div>
            ) : (
              TIERS.map((tier) => (
                <TierRow
                  key={tier}
                  tier={tier}
                  slotMap={slotMap}
                  activeSides={activeSides}
                  onPrint={setPrintTarget}
                />
              ))
            )}
          </div>

          {/* ── 범례 */}
          <div className="px-5 pb-2 flex items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-800 border border-gray-700" />빈 슬롯
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-900/30 border border-green-700" />입고됨
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-900/30 border border-amber-600" />혼적
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-900 border border-dashed border-red-800/60" />사용불가
            </span>
          </div>

          {/* ── 하단 버튼 */}
          <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700
                          px-5 py-4 flex justify-end gap-3 rounded-b-2xl">
            <button onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">
              닫기
            </button>
          </div>
        </div>
      </div>

      {printTarget && (
        <LabelPrinter pallet={printTarget} onClose={() => setPrintTarget(null)} />
      )}
    </>
  )
}

// ──────────────────────────────────────────
// 단(Tier) 한 행 — 좌(L) / 우(R) 슬롯
// ──────────────────────────────────────────
function TierRow({ tier, slotMap, activeSides, onPrint }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 items-stretch">
      <div className="flex items-center justify-center">
        <div className="bg-gray-700 text-gray-300 rounded-xl w-10 h-10
                        flex flex-col items-center justify-center text-xs font-bold leading-tight shrink-0">
          <span>{tier}</span>
          <span className="text-[9px] font-normal opacity-60">단</span>
        </div>
      </div>
      {SIDES.map((side) => {
        const disabled = !activeSides.includes(side)
        const pallet   = disabled ? null : slotMap.get(`${tier}-${side}`)
        return (
          <SlotCell key={side} tier={tier} side={side} pallet={pallet} disabled={disabled} onPrint={onPrint} />
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────
// 개별 슬롯 셀
// ──────────────────────────────────────────
function SlotCell({ tier, side, pallet, disabled, onPrint }) {
  if (disabled) {
    return (
      <div className="rounded-xl border border-dashed border-red-900/50 bg-gray-900/50
                      min-h-[110px] flex flex-col items-center justify-center gap-1.5">
        <span className="text-lg">🚫</span>
        <span className="text-[10px] text-red-800 font-semibold">사용불가</span>
        <span className="text-[10px] text-gray-700">{SIDE_KO[side]}측({side})</span>
      </div>
    )
  }

  const isEmpty   = !pallet
  const isMixed   = !isEmpty && (pallet.pallet_items?.length ?? 0) > 1
  const itemCount = pallet?.pallet_items?.length ?? 0

  const borderCls = isEmpty
    ? 'border-gray-700 bg-gray-800/40'
    : isMixed
      ? 'border-amber-600 bg-amber-900/20'
      : 'border-green-700 bg-green-900/15'

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[110px] ${borderCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">{SIDE_KO[side]}측({side})</span>
        <StatusChip empty={isEmpty} mixed={isMixed} />
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-700 text-sm">—</span>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-white font-mono tracking-tight truncate" title={pallet.code}>
            {pallet.code}
          </p>
          <p className="text-[11px] text-gray-500">입고 {formatDate(pallet.inbound_at)}</p>
          <ul className="space-y-1 flex-1">
            {pallet.pallet_items?.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-1 text-xs">
                <span className="text-gray-300 truncate flex-1" title={item.products?.name}>
                  {item.products?.name}
                </span>
                <span className="text-gray-500 shrink-0 font-mono">
                  {item.qty}{item.products?.unit}
                </span>
              </li>
            ))}
          </ul>
          {isMixed && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30
                               px-2 py-0.5 rounded-full font-semibold">혼적 {itemCount}종</span>
            </div>
          )}
          <button onClick={() => onPrint(pallet)}
            className="mt-1 w-full py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600
                       text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1">
            <span>🖨</span> 라벨 출력
          </button>
        </>
      )}
    </div>
  )
}

function StatusChip({ empty, mixed }) {
  if (empty) return <span className="text-[10px] text-green-500 font-semibold">빈 슬롯</span>
  if (mixed) return <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">혼적</span>
  return <span className="text-[10px] text-gray-400 font-semibold">입고됨</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
