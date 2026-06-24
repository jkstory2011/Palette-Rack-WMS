'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// 가동률 기준: 80% 이상 → full, 20% 이상 → partial, 0% → empty
function getStatusClass(usedRate) {
  if (usedRate >= 0.8) return 'rack-full'
  if (usedRate > 0)    return 'rack-partial'
  return 'rack-empty'
}

function getStatusLabel(usedRate) {
  if (usedRate >= 0.8) return '만석'
  if (usedRate > 0)    return '일부'
  return '여유'
}

export default function DashboardPage() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function fetchZoneStats() {
    // zones 테이블과 슬롯 점유율을 JOIN해서 구역별 통계 조회
    const { data, error } = await supabase
      .from('zones')
      .select(`
        id,
        code,
        name,
        racks (
          id,
          slots (
            id,
            pallet_id
          )
        )
      `)
      .order('code')

    if (error) {
      console.error('구역 조회 오류:', error)
      return
    }

    // 구역별 점유율 계산
    const computed = data.map((zone) => {
      const slots = zone.racks.flatMap((r) => r.slots)
      const total = slots.length
      const used  = slots.filter((s) => s.pallet_id !== null).length
      return {
        id:       zone.id,
        code:     zone.code,
        name:     zone.name,
        total,
        used,
        usedRate: total > 0 ? used / total : 0,
      }
    })

    setZones(computed)
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchZoneStats()

    // Realtime: slots 변경 시 자동 갱신
    const channel = supabase
      .channel('slots-change')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, fetchZoneStats)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg animate-pulse">창고 현황 불러오는 중...</p>
      </div>
    )
  }

  const totalSlots = zones.reduce((s, z) => s + z.total, 0)
  const usedSlots  = zones.reduce((s, z) => s + z.used, 0)
  const overallRate = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0

  return (
    <div className="space-y-6">

      {/* 전체 요약 헤더 */}
      <div className="wms-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">전체 창고 조감도</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              마지막 갱신: {lastUpdated.toLocaleTimeString('ko-KR')}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-white">{overallRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-400">{usedSlots} / {totalSlots} 슬롯 사용 중</p>
        </div>
      </div>

      {/* 전체 가동률 바 */}
      <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-700 ${
            overallRate >= 80 ? 'bg-red-500' : overallRate > 20 ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${overallRate}%` }}
        />
      </div>

      {/* 구역별 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {zones.map((zone) => {
          const pct = (zone.usedRate * 100).toFixed(0)
          return (
            <Link
              key={zone.id}
              href={`/zone/${zone.code}`}
              className="wms-card hover:border-blue-500 hover:bg-gray-800
                         transition-all duration-200 cursor-pointer group flex flex-col gap-3"
            >
              {/* 구역 코드 + 상태 배지 */}
              <div className="flex items-start justify-between">
                <span className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
                  {zone.code}
                </span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusClass(zone.usedRate)}`}>
                  {getStatusLabel(zone.usedRate)}
                </span>
              </div>

              {/* 구역 이름 */}
              <p className="text-sm text-gray-400 truncate">{zone.name}</p>

              {/* 미니 가동률 바 */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    zone.usedRate >= 0.8 ? 'bg-red-500' :
                    zone.usedRate > 0    ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* 슬롯 수치 */}
              <p className="text-right text-sm font-bold text-white">
                {pct}%
                <span className="text-gray-500 font-normal ml-1">
                  ({zone.used}/{zone.total})
                </span>
              </p>
            </Link>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-6 text-sm text-gray-400 no-print">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 여유 (0~19%)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> 일부 (20~79%)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 만석 (80%+)
        </span>
      </div>
    </div>
  )
}
