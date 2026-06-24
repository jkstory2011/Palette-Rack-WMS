'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ────────────────────────────────────────
// 탭 상수
// ────────────────────────────────────────
const TABS = { ZONE: 'zone', LOC: 'location' }

export default function LocationsPage() {
  const [tab, setTab] = useState(TABS.ZONE)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">구역 / 로케이션 관리</h1>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {[
          { key: TABS.ZONE, label: '🏭 구역(Zone) 관리' },
          { key: TABS.LOC,  label: '📍 로케이션 관리' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === TABS.ZONE ? <ZoneTab /> : <LocationTab />}
    </div>
  )
}


// ════════════════════════════════════════
// 구역 탭
// ════════════════════════════════════════
function ZoneTab() {
  const [zones, setZones]   = useState([])
  const [form, setForm]     = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const fetchZones = useCallback(async () => {
    const { data } = await supabase
      .from('zones')
      .select(`id, code, name, locations(id)`)
      .order('code')
    setZones(data ?? [])
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim() || !form.name.trim()) {
      return setError('구역코드와 구역명은 필수입니다.')
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('zones')
      .insert({ code: form.code.trim().toUpperCase(), name: form.name.trim() })
    setSaving(false)
    if (err) {
      return setError(err.code === '23505' ? '이미 존재하는 구역코드입니다.' : err.message)
    }
    setForm({ code: '', name: '' })
    fetchZones()
  }

  async function handleDelete(zone) {
    if (zone.locations?.length > 0) {
      return alert(`⚠️ ${zone.locations.length}개의 로케이션이 있습니다. 먼저 로케이션을 삭제하세요.`)
    }
    if (!confirm(`'${zone.code}' 구역을 삭제할까요?`)) return
    await supabase.from('zones').delete().eq('id', zone.id)
    fetchZones()
  }

  return (
    <div className="space-y-5">
      {/* 등록 폼 */}
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <h2 className="text-sm font-semibold text-gray-400">신규 구역 등록</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="구역 코드 *" placeholder="A, B, COLD …">
            <input value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="A" className={inputCls} />
          </Field>
          <Field label="구역 이름 *" className="sm:col-span-2">
            <input value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="A동 일반구역" className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={saving} className={btnCls}>
          {saving ? '등록 중...' : '+ 구역 추가'}
        </button>
      </form>

      {/* 목록 */}
      <div className="wms-card">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          전체 구역 <span className="text-gray-600">({zones.length}개)</span>
        </h2>
        {zones.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 구역이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-700 text-left">
                <th className="pb-2">코드</th>
                <th className="pb-2">이름</th>
                <th className="pb-2 text-center">로케이션 수</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {zones.map((z) => (
                <tr key={z.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3 font-bold text-white text-lg">{z.code}</td>
                  <td className="py-3 text-gray-300">{z.name}</td>
                  <td className="py-3 text-center text-gray-400">{z.locations?.length ?? 0}개</td>
                  <td className="py-3 text-right">
                    <button onClick={() => handleDelete(z)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


// ════════════════════════════════════════
// 로케이션 탭
// ════════════════════════════════════════
function LocationTab() {
  const [zones, setZones]         = useState([])
  const [zoneId, setZoneId]       = useState('')
  const [locations, setLocations] = useState([])
  const [form, setForm]           = useState({ code: '', grid_x: '', grid_y: '', aisle: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    supabase.from('zones').select('id, code, name').order('code')
      .then(({ data }) => setZones(data ?? []))
  }, [])

  const fetchLocations = useCallback(async (id) => {
    if (!id) { setLocations([]); return }
    const { data } = await supabase
      .from('locations')
      .select('id, code, grid_x, grid_y, aisle, is_active, pallets(id)')
      .eq('zone_id', id)
      .order('grid_y').order('grid_x')
    setLocations(data ?? [])
  }, [])

  useEffect(() => { fetchLocations(zoneId) }, [zoneId, fetchLocations])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const { code, grid_x, grid_y } = form
    if (!zoneId)           return setError('구역을 먼저 선택하세요.')
    if (!code.trim())      return setError('로케이션 코드를 입력하세요.')
    if (!grid_x || !grid_y) return setError('격자 좌표(X열, Y행)를 입력하세요.')

    setSaving(true)
    const { error: err } = await supabase.from('locations').insert({
      zone_id: Number(zoneId),
      code:    code.trim().toUpperCase(),
      grid_x:  Number(grid_x),
      grid_y:  Number(grid_y),
      aisle:   form.aisle.trim() || null,
    })
    setSaving(false)
    if (err) {
      return setError(
        err.code === '23505'
          ? '이미 같은 코드 또는 같은 좌표가 존재합니다.'
          : err.message,
      )
    }
    setForm({ code: '', grid_x: '', grid_y: '', aisle: '' })
    fetchLocations(zoneId)
  }

  async function handleToggleActive(loc) {
    await supabase.from('locations')
      .update({ is_active: !loc.is_active })
      .eq('id', loc.id)
    fetchLocations(zoneId)
  }

  async function handleDelete(loc) {
    const palletCount = loc.pallets?.length ?? 0
    if (palletCount > 0) {
      return alert(`⚠️ 이 로케이션에 파렛트 ${palletCount}개가 있어 삭제할 수 없습니다.`)
    }
    if (!confirm(`'${loc.code}' 로케이션을 삭제할까요?`)) return
    await supabase.from('locations').delete().eq('id', loc.id)
    fetchLocations(zoneId)
  }

  // 격자 미리보기용
  const maxX = locations.length > 0 ? Math.max(...locations.map((l) => l.grid_x)) : 0
  const maxY = locations.length > 0 ? Math.max(...locations.map((l) => l.grid_y)) : 0
  const locMap = new Map(locations.map((l) => [`${l.grid_x}-${l.grid_y}`, l]))

  return (
    <div className="space-y-5">
      {/* 구역 선택 */}
      <div className="wms-card">
        <label className="block text-xs font-medium text-gray-400 mb-2">구역 선택</label>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={selectCls}>
          <option value="">구역을 선택하세요...</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.code} — {z.name}</option>
          ))}
        </select>
      </div>

      {zoneId && (
        <>
          {/* 격자 미리보기 */}
          {locations.length > 0 && (
            <div className="wms-card overflow-x-auto">
              <p className="text-xs text-gray-500 mb-3">
                현재 격자 구성 ({locations.length}개 로케이션)
              </p>
              <div className="inline-grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${maxX}, minmax(56px, 1fr))` }}>
                {Array.from({ length: maxY }, (_, r) =>
                  Array.from({ length: maxX }, (_, c) => {
                    const loc = locMap.get(`${c + 1}-${r + 1}`)
                    return (
                      <div
                        key={`${c}-${r}`}
                        className={`h-10 rounded-lg text-[10px] font-bold flex items-center
                                    justify-center border transition-colors ${
                          !loc
                            ? 'border-dashed border-gray-700 text-gray-700'
                            : loc.is_active
                              ? 'bg-blue-900/40 border-blue-700 text-blue-300'
                              : 'bg-gray-800 border-gray-700 text-gray-600'
                        }`}
                      >
                        {loc ? loc.code : `${c+1},${r+1}`}
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-[10px] text-gray-700 mt-2">← X(열) 방향 / ↓ Y(행) 방향</p>
            </div>
          )}

          {/* 등록 폼 */}
          <form onSubmit={handleAdd} className="wms-card space-y-4">
            <h2 className="text-sm font-semibold text-gray-400">신규 로케이션 추가</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="로케이션 코드 *">
                <input value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="A-13" className={inputCls} />
              </Field>
              <Field label="X 열 * (가로)">
                <input type="number" min="1" value={form.grid_x}
                  onChange={(e) => setForm((f) => ({ ...f, grid_x: e.target.value }))}
                  placeholder="5" className={inputCls} />
              </Field>
              <Field label="Y 행 * (세로)">
                <input type="number" min="1" value={form.grid_y}
                  onChange={(e) => setForm((f) => ({ ...f, grid_y: e.target.value }))}
                  placeholder="1" className={inputCls} />
              </Field>
              <Field label="통로 (선택)">
                <input value={form.aisle}
                  onChange={(e) => setForm((f) => ({ ...f, aisle: e.target.value }))}
                  placeholder="1번 통로" className={inputCls} />
              </Field>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={saving} className={btnCls}>
              {saving ? '등록 중...' : '+ 로케이션 추가'}
            </button>
          </form>

          {/* 로케이션 목록 */}
          <div className="wms-card">
            <h2 className="text-sm font-semibold text-gray-400 mb-4">
              로케이션 목록 <span className="text-gray-600">({locations.length}개)</span>
            </h2>
            {locations.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">
                이 구역에 등록된 로케이션이 없습니다.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-700 text-left">
                    <th className="pb-2">코드</th>
                    <th className="pb-2 text-center">X(열)</th>
                    <th className="pb-2 text-center">Y(행)</th>
                    <th className="pb-2">통로</th>
                    <th className="pb-2 text-center">파렛트</th>
                    <th className="pb-2 text-center">상태</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {locations.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 font-bold text-white font-mono">{l.code}</td>
                      <td className="py-2.5 text-center text-gray-400">{l.grid_x}</td>
                      <td className="py-2.5 text-center text-gray-400">{l.grid_y}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{l.aisle ?? '—'}</td>
                      <td className="py-2.5 text-center text-gray-400">
                        {l.pallets?.length ?? 0}
                      </td>
                      <td className="py-2.5 text-center">
                        <button onClick={() => handleToggleActive(l)}
                          className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
                            l.is_active
                              ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                              : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                          }`}>
                          {l.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => handleDelete(l)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── 공통 컴포넌트
function Field({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls  = `w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white
                   text-sm placeholder-gray-600 focus:outline-none focus:ring-2
                   focus:ring-blue-500/50 focus:border-blue-500`
const selectCls = `w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white
                   text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500`
const btnCls    = `px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm
                   font-semibold transition-colors disabled:opacity-40`
