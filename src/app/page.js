'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
  const [zones, setZones]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchZoneStats = useCallback(async () => {
    // zones → locations → pallets(stored) 조인
    const { data, error: err } = await supabase
      .from('zones')
      .select(`
        id, code, name,
        locations (
          id,
          pallets ( id, status )
        )
      `)
      .order('code')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // 구역별 점유율 계산
    // 로케이션 1개 = 4단 × 좌/우 = 최대 8 파렛트 슬롯
    const computed = (data ?? []).map((zone) => {
      const locations  = zone.locations ?? []
      const totalSlots = locations.length * 8
      const usedSlots  = locations.reduce(
        (sum, loc) =>
          sum + (loc.pallets ?? []).filter((p) => p.status === 'stored').length,
        0,
      )
      return {
        id:       zone.id,
        code:     zone.code,
        name:     zone.name,
        total:    totalSlots,
        used:     usedSlots,
        usedRate: totalSlots > 0 ? usedSlots / totalSlots : 0,
        locCount: locations.length,
      }
    })

    setZones(computed)
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchZoneStats()

    // 파렛트 변경 시 실시간 갱신
    const channel = supabase
      .channel('dashboard-pallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pallets' }, fetchZoneStats)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchZoneStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-lg animate-pulse">창고 현황 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-lg">데이터 조회 오류</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button
          onClick={fetchZoneStats}
          className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  const totalSlots  = zones.reduce((s, z) => s + z.total, 0)
  const usedSlots   = zones.reduce((s, z) => s + z.used, 0)
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
            overallRate >= 80 ? 'bg-red-500' :
            overallRate > 0   ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.max(overallRate, 0)}%` }}
        />
      </div>

      {/* 구역별 카드 그리드 */}
      {zones.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">등록된 구역이 없습니다.</p>
          <Link href="/locations" className="text-blue-400 hover:underline text-sm">
            📍 로케이션 관리에서 구역을 추가하세요
          </Link>
        </div>
      ) : (
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

                {/* 로케이션 수 */}
                <p className="text-xs text-gray-600 text-right -mt-1">
                  랙 {zone.locCount}개
                </p>
              </Link>
            )
          })}
        </div>
      )}

      {/* 범례 */}
      <div className="flex items-center gap-6 text-sm text-gray-400 no-print">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 여유
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> 일부 사용
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 만석 (80%+)
        </span>
        <button
          onClick={fetchZoneStats}
          className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          ↻ 새로고침
        </button>
      </div>
    </div>
  )
}
