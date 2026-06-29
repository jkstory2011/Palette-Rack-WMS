'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import RackModal from '@/components/RackModal'

// ──────────────────────────────────────────
// 로케이션 상태 계산
//   stored  pallets 중 pallet_items > 1 개인 것이 있으면 → 'mixed'  (혼적, 주황)
//   모든 슬롯 사용 (8개) → 'full'     (빨강)
//   일부 사용 → 'stored'   (초록)
//   비어 있음 → 'empty'    (회색)
// ──────────────────────────────────────────
function calcStatus(location) {
  const stored = (location.pallets ?? []).filter((p) => p.status === 'stored')
  if (stored.length === 0) return 'empty'
  const hasMixed = stored.some((p) => (p.pallet_items?.length ?? 0) > 1)
  if (hasMixed) return 'mixed'
  if (stored.length >= 8) return 'full'
  return 'stored'
}

const STATUS_STYLE = {
  empty:  { bg: 'bg-gray-700 border-gray-600',           text: 'text-gray-400', label: '빈 랙' },
  stored: { bg: 'bg-green-700 border-green-600',          text: 'text-green-100', label: '보관 중' },
  mixed:  { bg: 'bg-amber-500 border-amber-400',          text: 'text-white',      label: '혼적' },
  full:   { bg: 'bg-red-600   border-red-500',            text: 'text-white',      label: '만석' },
}

export default function ZonePage() {
  const { zoneCode } = useParams()
  const [zone, setZone]                   = useState(null)
  const [locations, setLocations]         = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [loading, setLoading]             = useState(true)

  const fetchData = useCallback(async () => {
    // 1) 구역 정보
    const { data: zoneRow, error: zoneErr } = await supabase
      .from('zones')
      .select('id, code, name')
      .eq('code', zoneCode)
      .single()

    if (zoneErr || !zoneRow) {
      setLoading(false)
      return
    }
    setZone(zoneRow)

    // 2) 로케이션 + 파렛트 + 혼적 여부 판별용 pallet_items 개수만 조회
    const { data: locs } = await supabase
      .from('locations')
      .select(`
        id, code, grid_x, grid_y, aisle, is_active,
        pallets (
          id, tier, side, status,
          pallet_items ( id )
        )
      `)
      .eq('zone_id', zoneRow.id)
      .eq('is_active', true)
      .order('grid_y')
      .order('grid_x')

    setLocations(locs ?? [])
    setLoading(false)
  }, [zoneCode])

  useEffect(() => {
    fetchData()

    // 파렛트 변경 시 자동 갱신
    const channel = supabase
      .channel(`zone-grid-${zoneCode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, fetchData)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchData, zoneCode])

  // ── 로딩 / 없는 구역 처리
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg animate-pulse">구역 데이터 불러오는 중...</p>
      </div>
    )
  }
  if (!zone) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-2xl text-gray-500">구역 '{zoneCode}'을 찾을 수 없습니다.</p>
        <Link href="/" className="text-[#F59E0B] hover:underline">← 전체 조감도로</Link>
      </div>
    )
  }

  // ── 격자 크기 계산
  const maxX = locations.length > 0 ? Math.max(...locations.map((l) => l.grid_x)) : 1
  const maxY = locations.length > 0 ? Math.max(...locations.map((l) => l.grid_y)) : 1

  // (grid_x, grid_y) → location 빠른 조회
  const locMap = new Map(locations.map((l) => [`${l.grid_x}-${l.grid_y}`, l]))

  // 구역 요약 통계
  const totalSlots   = locations.length * 8
  const storedAll    = locations.flatMap((l) => (l.pallets ?? []).filter((p) => p.status === 'stored'))
  const usedSlots    = storedAll.length
  const mixedCount   = locations.filter((l) => calcStatus(l) === 'mixed').length
  const usedPct      = totalSlots > 0 ? ((usedSlots / totalSlots) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">

      {/* ── 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← 전체 조감도
          </Link>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">
            {zone.code} 구역
            <span className="text-slate-400 font-normal text-xl ml-2">— {zone.name}</span>
          </h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Stat label="전체 슬롯" value={`${usedSlots} / ${totalSlots}`} />
          <Stat label="가동률"    value={`${usedPct}%`} highlight />
          <Stat label="혼적 랙"   value={`${mixedCount}개`} amber />
        </div>
      </div>

      {/* ── 격자 맵 */}
      <div className="wms-card overflow-x-auto">
        <p className="text-xs text-gray-500 mb-4">
          랙을 클릭하면 4단 × 좌/우 슬롯 상세를 확인할 수 있습니다.
        </p>

        {/* 격자 래퍼: max-content로 실제 너비를 확장해 수평 스크롤 활성화 */}
        <div style={{ width: 'max-content', minWidth: '100%' }}>

        {/* 열 번호 헤더 */}
        <div
          className="grid gap-2 mb-1 pl-10"
          style={{ gridTemplateColumns: `repeat(${maxX}, 80px)` }}
        >
          {Array.from({ length: maxX }, (_, i) => (
            <div key={i} className="text-center text-xs text-gray-600">{i + 1}열</div>
          ))}
        </div>

        {/* 행 × 열 격자 */}
        {Array.from({ length: maxY }, (_, rowIdx) => {
          const gridY = rowIdx + 1
          return (
            <div key={gridY} className="flex items-center gap-2 mb-2">
              {/* 행 번호 */}
              <div className="w-8 shrink-0 text-center text-xs text-gray-600">{gridY}</div>

              {/* 각 열 셀 */}
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${maxX}, 80px)` }}
              >
                {Array.from({ length: maxX }, (_, colIdx) => {
                  const gridX = colIdx + 1
                  const loc   = locMap.get(`${gridX}-${gridY}`)

                  // 로케이션이 없는 자리 → 빈 공간
                  if (!loc) {
                    return <div key={gridX} className="h-16 rounded-xl bg-gray-900/30" />
                  }

                  const status = calcStatus(loc)
                  const style  = STATUS_STYLE[status]
                  const stored = (loc.pallets ?? []).filter((p) => p.status === 'stored')

                  return (
                    <button
                      key={gridX}
                      onClick={() => setSelectedLocation(loc)}
                      className={`
                        h-16 rounded-xl border text-left px-2.5 py-2
                        flex flex-col justify-between
                        transition-all duration-150
                        hover:scale-[1.04] hover:shadow-lg active:scale-[0.97]
                        focus:outline-none focus:ring-2 focus:ring-blue-500/60
                        ${style.bg}
                      `}
                      title={`${loc.code} — ${style.label}`}
                    >
                      {/* 랙 코드 */}
                      <span className={`text-xs font-bold leading-none ${style.text}`}>
                        {loc.code}
                      </span>

                      {/* 상태 + 사용 수 */}
                      <div className="flex items-end justify-between">
                        <span className={`text-[10px] font-semibold ${style.text} opacity-90`}>
                          {style.label}
                        </span>
                        <span className={`text-[10px] ${style.text} opacity-70`}>
                          {stored.length}/8
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        </div>{/* end: 격자 래퍼 */}

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-gray-800 text-xs text-gray-400">
          {Object.entries(STATUS_STYLE).map(([key, s]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm border ${s.bg}`} />
              {s.label}
            </span>
          ))}
          <span className="ml-auto text-gray-600">클릭 → 4단 상세 보기</span>
        </div>
      </div>

      {/* ── 통로 구분 안내 */}
      {locations.some((l) => l.aisle) && (
        <div className="wms-card text-sm text-gray-400">
          <p className="font-semibold text-gray-300 mb-2">통로 구분</p>
          <div className="flex flex-wrap gap-3">
            {[...new Set(locations.map((l) => l.aisle).filter(Boolean))].map((aisle) => (
              <span key={aisle} className="px-3 py-1 bg-gray-800 rounded-full">{aisle}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── 3단계: 랙 상세 팝업 모달 */}
      {selectedLocation && (
        <RackModal
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}

// 헤더 통계 칩
function Stat({ label, value, highlight, amber }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-black leading-none ${
        highlight ? 'text-white' : amber ? 'text-amber-400' : 'text-gray-300'
      }`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
