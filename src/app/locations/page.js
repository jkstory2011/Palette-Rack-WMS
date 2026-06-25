'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const TABS = { ZONE: 'zone', LOC: 'location' }

export default function LocationsPage() {
  const [tab, setTab] = useState(TABS.ZONE)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">구역 / 로케이션 관리</h1>

      <div className="flex gap-2 border-b border-gray-700">
        {[
          { key: TABS.ZONE, label: '🏭 구역(Zone) 관리' },
          { key: TABS.LOC,  label: '📍 로케이션 관리' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}>
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
  const [zones, setZones]     = useState([])
  const [form, setForm]       = useState({ code: '', name: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [showBulk, setShowBulk] = useState(false)

  const fetchZones = useCallback(async () => {
    const { data } = await supabase.from('zones')
      .select('id, code, name, locations(id)').order('code')
    setZones(data ?? [])
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.code.trim() || !form.name.trim())
      return setError('구역코드와 구역명은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('zones')
      .insert({ code: form.code.trim().toUpperCase(), name: form.name.trim() })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 구역코드입니다.' : err.message)
    setForm({ code: '', name: '' })
    fetchZones()
  }

  async function handleDelete(zone) {
    if (zone.locations?.length > 0)
      return alert(`⚠️ ${zone.locations.length}개의 로케이션이 있습니다. 먼저 로케이션을 삭제하세요.`)
    if (!confirm(`'${zone.code}' 구역을 삭제할까요?`)) return
    await supabase.from('zones').delete().eq('id', zone.id)
    fetchZones()
  }

  return (
    <div className="space-y-5">
      {/* 단건 등록 */}
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400">신규 구역 등록</h2>
          <button type="button" onClick={() => setShowBulk(true)}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600
                       text-white text-sm font-semibold transition-colors">
            📋 일괄 추가
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="구역 코드 *">
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="A" className={inputCls} />
          </Field>
          <Field label="구역 이름 *" className="sm:col-span-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
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
              {zones.map(z => (
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

      {showBulk && (
        <BulkZoneModal
          onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); fetchZones() }}
        />
      )}
    </div>
  )
}

// ── 구역 일괄 추가 모달
function BulkZoneModal({ onClose, onSuccess }) {
  const [text, setText]       = useState('')
  const [preview, setPreview] = useState([])
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState(null)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    setPreview(lines.map(line => {
      const parts = line.split(/[,\t]/)
      const code  = (parts[0] ?? '').trim().toUpperCase()
      const name  = (parts[1] ?? '').trim()
      return { code, name, valid: !!code && !!name }
    }))
  }, [text])

  async function handleSave() {
    const rows = preview.filter(r => r.valid)
    if (rows.length === 0) return
    setSaving(true)
    let success = 0, skipped = 0
    const errors = []
    for (const row of rows) {
      const { error } = await supabase.from('zones').insert({ code: row.code, name: row.name })
      if (!error) success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setSaving(false)
    setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  const validCount = preview.filter(r => r.valid).length

  return (
    <Modal title="📋 구역 일괄 추가" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-300">입력 형식</p>
          <p>한 줄에 구역코드, 구역이름 순으로 입력 (쉼표 또는 탭으로 구분)</p>
          <p className="font-mono text-gray-500">A, A동 일반구역{'\n'}B, B동 냉동구역{'\n'}COLD, 냉장창고</p>
        </div>

        <Field label="구역 목록 입력">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            placeholder={'A, A동 일반구역\nB, B동 냉동구역\nCOLD, 냉장창고'}
            className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                       text-white text-sm placeholder-gray-600 font-mono resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </Field>

        {/* 미리보기 */}
        {preview.length > 0 && !result && (
          <div>
            <p className="text-xs text-gray-400 mb-2">
              미리보기 — 유효 <span className="text-green-400 font-bold">{validCount}</span>건 /
              오류 <span className="text-red-400">{preview.length - validCount}</span>건
            </p>
            <div className="border border-gray-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 sticky top-0">
                  <tr className="text-gray-400">
                    <th className="px-3 py-2 text-left">코드</th>
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-center w-12">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {preview.map((r, i) => (
                    <tr key={i} className={r.valid ? '' : 'bg-red-900/10'}>
                      <td className="px-3 py-2 font-bold font-mono text-white">{r.code || <span className="text-red-400">없음</span>}</td>
                      <td className="px-3 py-2 text-gray-300">{r.name || <span className="text-red-400">없음</span>}</td>
                      <td className="px-3 py-2 text-center">{r.valid ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-green-400 font-bold">✅ 등록 성공 {result.success}건</p>
            {result.skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}건</p>}
            {result.errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
          </div>
        )}
      </div>

      <ModalFooter>
        <button onClick={onClose} className={`${btnCls} bg-gray-700 hover:bg-gray-600`}>닫기</button>
        {!result && (
          <button onClick={handleSave} disabled={saving || validCount === 0} className={btnCls}>
            {saving ? '등록 중...' : `+ ${validCount}개 구역 등록`}
          </button>
        )}
      </ModalFooter>
    </Modal>
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
  const [showBulk, setShowBulk]   = useState(false)

  useEffect(() => {
    supabase.from('zones').select('id, code, name').order('code')
      .then(({ data }) => setZones(data ?? []))
  }, [])

  const fetchLocations = useCallback(async (id) => {
    if (!id) { setLocations([]); return }
    const { data } = await supabase.from('locations')
      .select('id, code, grid_x, grid_y, aisle, is_active, pallets(id)')
      .eq('zone_id', id).order('grid_y').order('grid_x')
    setLocations(data ?? [])
  }, [])

  useEffect(() => { fetchLocations(zoneId) }, [zoneId, fetchLocations])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!zoneId)                     return setError('구역을 먼저 선택하세요.')
    if (!form.code.trim())           return setError('로케이션 코드를 입력하세요.')
    if (!form.grid_x || !form.grid_y) return setError('격자 좌표(X열, Y행)를 입력하세요.')
    setSaving(true)
    const { error: err } = await supabase.from('locations').insert({
      zone_id: Number(zoneId), code: form.code.trim().toUpperCase(),
      grid_x: Number(form.grid_x), grid_y: Number(form.grid_y),
      aisle: form.aisle.trim() || null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 같은 코드 또는 좌표가 존재합니다.' : err.message)
    setForm({ code: '', grid_x: '', grid_y: '', aisle: '' })
    fetchLocations(zoneId)
  }

  async function handleToggleActive(loc) {
    await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    fetchLocations(zoneId)
  }

  async function handleDelete(loc) {
    const count = loc.pallets?.length ?? 0
    if (count > 0) return alert(`⚠️ 이 로케이션에 파렛트 ${count}개가 있어 삭제할 수 없습니다.`)
    if (!confirm(`'${loc.code}' 로케이션을 삭제할까요?`)) return
    await supabase.from('locations').delete().eq('id', loc.id)
    fetchLocations(zoneId)
  }

  const maxX   = locations.length > 0 ? Math.max(...locations.map(l => l.grid_x)) : 0
  const maxY   = locations.length > 0 ? Math.max(...locations.map(l => l.grid_y)) : 0
  const locMap = new Map(locations.map(l => [`${l.grid_x}-${l.grid_y}`, l]))

  return (
    <div className="space-y-5">
      {/* 구역 선택 */}
      <div className="wms-card">
        <label className="block text-xs font-medium text-gray-400 mb-2">구역 선택</label>
        <select value={zoneId} onChange={e => setZoneId(e.target.value)} className={selectCls}>
          <option value="">구역을 선택하세요...</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
        </select>
      </div>

      {zoneId && (
        <>
          {/* 격자 미리보기 */}
          {locations.length > 0 && (
            <div className="wms-card overflow-x-auto">
              <p className="text-xs text-gray-500 mb-3">현재 격자 구성 ({locations.length}개 로케이션)</p>
              <div className="inline-grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${maxX}, minmax(56px, 1fr))` }}>
                {Array.from({ length: maxY }, (_, r) =>
                  Array.from({ length: maxX }, (_, c) => {
                    const loc = locMap.get(`${c+1}-${r+1}`)
                    return (
                      <div key={`${c}-${r}`}
                        className={`h-10 rounded-lg text-[10px] font-bold flex items-center
                                    justify-center border transition-colors ${
                          !loc
                            ? 'border-dashed border-gray-700 text-gray-700'
                            : loc.is_active
                              ? 'bg-blue-900/40 border-blue-700 text-blue-300'
                              : 'bg-gray-800 border-gray-700 text-gray-600'
                        }`}>
                        {loc ? loc.code : `${c+1},${r+1}`}
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-[10px] text-gray-700 mt-2">← X(열) 방향 / ↓ Y(행) 방향</p>
            </div>
          )}

          {/* 단건 등록 */}
          <form onSubmit={handleAdd} className="wms-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400">로케이션 추가</h2>
              <button type="button" onClick={() => setShowBulk(true)}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600
                           text-white text-sm font-semibold transition-colors">
                🔢 일괄 추가
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="로케이션 코드 *">
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="A-13" className={inputCls} />
              </Field>
              <Field label="X 열 * (가로)">
                <input type="number" min="1" value={form.grid_x}
                  onChange={e => setForm(f => ({ ...f, grid_x: e.target.value }))}
                  placeholder="5" className={inputCls} />
              </Field>
              <Field label="Y 행 * (세로)">
                <input type="number" min="1" value={form.grid_y}
                  onChange={e => setForm(f => ({ ...f, grid_y: e.target.value }))}
                  placeholder="1" className={inputCls} />
              </Field>
              <Field label="통로 (선택)">
                <input value={form.aisle} onChange={e => setForm(f => ({ ...f, aisle: e.target.value }))}
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
              <p className="text-gray-600 text-sm text-center py-8">이 구역에 등록된 로케이션이 없습니다.</p>
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
                  {locations.map(l => (
                    <tr key={l.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 font-bold text-white font-mono">{l.code}</td>
                      <td className="py-2.5 text-center text-gray-400">{l.grid_x}</td>
                      <td className="py-2.5 text-center text-gray-400">{l.grid_y}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{l.aisle ?? '—'}</td>
                      <td className="py-2.5 text-center text-gray-400">{l.pallets?.length ?? 0}</td>
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

      {showBulk && zoneId && (
        <BulkLocationModal
          zoneId={zoneId}
          zoneName={zones.find(z => String(z.id) === String(zoneId))?.code ?? ''}
          existingCodes={new Set(locations.map(l => l.code))}
          existingSlots={new Set(locations.map(l => `${l.grid_x}-${l.grid_y}`))}
          onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); fetchLocations(zoneId) }}
        />
      )}
    </div>
  )
}

// ── 로케이션 일괄 추가 모달
function BulkLocationModal({ zoneId, zoneName, existingCodes, existingSlots, onClose, onSuccess }) {
  const [mode, setMode] = useState('pattern')   // 'pattern' | 'text'

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <Modal title={`🔢 로케이션 일괄 추가 — ${zoneName}구역`} onClose={onClose} wide>
      {/* 모드 선택 탭 */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'pattern', label: '🔢 패턴 자동 생성' },
          { key: 'text',    label: '✏️ 직접 입력' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setMode(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              mode === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'pattern'
        ? <PatternMode zoneId={zoneId} existingCodes={existingCodes} existingSlots={existingSlots} onClose={onClose} onSuccess={onSuccess} />
        : <TextMode    zoneId={zoneId} existingCodes={existingCodes}                                onClose={onClose} onSuccess={onSuccess} />
      }
    </Modal>
  )
}

// 패턴 자동 생성 모드
function PatternMode({ zoneId, existingCodes, existingSlots, onClose, onSuccess }) {
  const [cfg, setCfg] = useState({
    prefix: '',        // 코드 접두사 (예: A-)
    startNo: 1,        // 시작 번호
    endNo: 10,         // 끝 번호
    padding: 2,        // 자릿수 (01, 001...)
    cols: 5,           // 열 개수 (한 행당 로케이션 수)
    startX: 1,         // 시작 X 좌표
    startY: 1,         // 시작 Y 좌표
    aisle: '',         // 통로 (공통)
  })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  function set(key, val) {
    setCfg(c => ({ ...c, [key]: val }))
  }

  // 미리보기 데이터 생성
  const generated = useMemo(() => {
    const rows = []
    const total = Number(cfg.endNo) - Number(cfg.startNo) + 1
    if (total <= 0 || total > 500) return rows
    for (let i = 0; i < total; i++) {
      const no   = Number(cfg.startNo) + i
      const code = `${cfg.prefix}${String(no).padStart(Number(cfg.padding), '0')}`
      const col  = i % Number(cfg.cols)
      const row  = Math.floor(i / Number(cfg.cols))
      const x    = Number(cfg.startX) + col
      const y    = Number(cfg.startY) + row
      const slotKey = `${x}-${y}`
      const dupCode = existingCodes.has(code)
      const dupSlot = existingSlots.has(slotKey)
      rows.push({ code, x, y, aisle: cfg.aisle || null, dupCode, dupSlot, skip: dupCode || dupSlot })
    }
    return rows
  }, [cfg, existingCodes, existingSlots])

  const newCount   = generated.filter(r => !r.skip).length
  const skipCount  = generated.filter(r =>  r.skip).length

  async function handleSave() {
    const rows = generated.filter(r => !r.skip)
    if (rows.length === 0) return
    setSaving(true)
    const inserts = rows.map(r => ({
      zone_id: Number(zoneId), code: r.code.toUpperCase(),
      grid_x: r.x, grid_y: r.y, aisle: r.aisle,
    }))
    // 50개씩 배치 삽입
    let success = 0
    for (let i = 0; i < inserts.length; i += 50) {
      const { error } = await supabase.from('locations').insert(inserts.slice(i, i + 50))
      if (!error) success += Math.min(50, inserts.length - i)
    }
    setSaving(false)
    setResult({ success, skipped: skipCount })
    if (success > 0) onSuccess()
  }

  // 격자 미리보기 (최대 5행×cols열만 표시)
  const previewGrid = useMemo(() => {
    const cols = Number(cfg.cols)
    const rows = Math.ceil(generated.length / cols)
    return { rows: Math.min(rows, 6), cols }
  }, [generated, cfg.cols])

  return (
    <div className="space-y-5">
      {/* 설정 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="코드 접두사">
          <input value={cfg.prefix} onChange={e => set('prefix', e.target.value)}
            placeholder="A-" className={inputCls} />
        </Field>
        <Field label="시작 번호">
          <input type="number" min="0" value={cfg.startNo}
            onChange={e => set('startNo', e.target.value)} className={inputCls} />
        </Field>
        <Field label="끝 번호">
          <input type="number" min="1" value={cfg.endNo}
            onChange={e => set('endNo', e.target.value)} className={inputCls} />
        </Field>
        <Field label="번호 자릿수">
          <input type="number" min="1" max="5" value={cfg.padding}
            onChange={e => set('padding', e.target.value)} className={inputCls} />
        </Field>
        <Field label="열 개수 (가로)">
          <input type="number" min="1" value={cfg.cols}
            onChange={e => set('cols', e.target.value)} className={inputCls} />
        </Field>
        <Field label="시작 X 좌표">
          <input type="number" min="1" value={cfg.startX}
            onChange={e => set('startX', e.target.value)} className={inputCls} />
        </Field>
        <Field label="시작 Y 좌표">
          <input type="number" min="1" value={cfg.startY}
            onChange={e => set('startY', e.target.value)} className={inputCls} />
        </Field>
        <Field label="공통 통로 (선택)">
          <input value={cfg.aisle} onChange={e => set('aisle', e.target.value)}
            placeholder="1번 통로" className={inputCls} />
        </Field>
      </div>

      {/* 생성 미리보기 요약 */}
      {generated.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-gray-400">생성 예정:</span>
            <span className="text-white font-bold">{generated.length}개</span>
            <span className="text-green-400 font-semibold">✓ 신규 {newCount}개</span>
            {skipCount > 0 && <span className="text-yellow-400">⚠ 중복 건너뜀 {skipCount}개</span>}
          </div>

          {/* 격자 시각화 (처음 6행만) */}
          <div>
            <p className="text-xs text-gray-500 mb-2">격자 배치 미리보기 (최대 6행)</p>
            <div className="inline-grid gap-1 overflow-x-auto"
              style={{ gridTemplateColumns: `repeat(${previewGrid.cols}, minmax(52px, 1fr))` }}>
              {generated.slice(0, previewGrid.rows * previewGrid.cols).map((r, i) => (
                <div key={i}
                  className={`h-9 rounded text-[9px] font-bold flex items-center justify-center
                              border truncate px-1 ${
                    r.skip
                      ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-600'
                      : 'bg-blue-900/40 border-blue-700 text-blue-300'
                  }`}>
                  {r.code}
                </div>
              ))}
            </div>
            {generated.length > previewGrid.rows * previewGrid.cols && (
              <p className="text-xs text-gray-600 mt-1">
                + {generated.length - previewGrid.rows * previewGrid.cols}개 더...
              </p>
            )}
            <div className="flex gap-3 mt-2 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-900/40 border border-blue-700 rounded inline-block" /> 신규</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-900/20 border border-yellow-700/40 rounded inline-block" /> 중복 (건너뜀)</span>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
          <p className="text-green-400 font-bold">✅ 등록 완료 {result.success}개</p>
          {result.skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}개</p>}
        </div>
      )}

      <ModalFooter>
        <button onClick={onClose} className={`${btnCls} bg-gray-700 hover:bg-gray-600`}>닫기</button>
        {!result && (
          <button onClick={handleSave} disabled={saving || newCount === 0} className={btnCls}>
            {saving ? '등록 중...' : `+ ${newCount}개 로케이션 등록`}
          </button>
        )}
      </ModalFooter>
    </div>
  )
}

// 직접 입력 모드
function TextMode({ zoneId, existingCodes, onClose, onSuccess }) {
  const [text, setText]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState(null)

  const preview = useMemo(() => {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,\t]/)
      const code  = (parts[0] ?? '').trim().toUpperCase()
      const x     = parseInt(parts[1] ?? '')
      const y     = parseInt(parts[2] ?? '')
      const aisle = (parts[3] ?? '').trim() || null
      const dup   = existingCodes.has(code)
      const valid = !!code && !isNaN(x) && x > 0 && !isNaN(y) && y > 0 && !dup
      return { code, x, y, aisle, valid, dup }
    })
  }, [text, existingCodes])

  const validCount = preview.filter(r => r.valid).length

  async function handleSave() {
    const rows = preview.filter(r => r.valid)
    if (rows.length === 0) return
    setSaving(true)
    let success = 0, skipped = 0
    const errors = []
    for (const row of rows) {
      const { error } = await supabase.from('locations').insert({
        zone_id: Number(zoneId), code: row.code,
        grid_x: row.x, grid_y: row.y, aisle: row.aisle,
      })
      if (!error) success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setSaving(false)
    setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 space-y-1">
        <p className="font-semibold text-gray-300">입력 형식</p>
        <p>한 줄에 하나씩: <span className="font-mono text-gray-300">코드, X열, Y행, 통로(선택)</span></p>
        <p className="font-mono text-gray-500 whitespace-pre">{'A-01, 1, 1, 1번통로\nA-02, 2, 1, 1번통로\nA-06, 1, 2'}</p>
      </div>

      <Field label="로케이션 목록 입력">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
          placeholder={'A-01, 1, 1, 1번통로\nA-02, 2, 1, 1번통로\nA-06, 1, 2'}
          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3
                     text-white text-sm placeholder-gray-600 font-mono resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
      </Field>

      {preview.length > 0 && !result && (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            미리보기 — 유효 <span className="text-green-400 font-bold">{validCount}</span>건 /
            오류·중복 <span className="text-red-400">{preview.length - validCount}</span>건
          </p>
          <div className="border border-gray-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr className="text-gray-400">
                  <th className="px-3 py-2 text-left">코드</th>
                  <th className="px-3 py-2 text-center">X</th>
                  <th className="px-3 py-2 text-center">Y</th>
                  <th className="px-3 py-2 text-left">통로</th>
                  <th className="px-3 py-2 text-center w-14">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {preview.map((r, i) => (
                  <tr key={i} className={r.valid ? '' : 'bg-red-900/10'}>
                    <td className="px-3 py-2 font-mono font-bold text-white">
                      {r.code || <span className="text-red-400">없음</span>}
                      {r.dup && <span className="text-yellow-400 ml-1 text-[10px]">중복</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-400">
                      {isNaN(r.x) ? <span className="text-red-400">?</span> : r.x}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-400">
                      {isNaN(r.y) ? <span className="text-red-400">?</span> : r.y}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.aisle ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.valid ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
          <p className="text-green-400 font-bold">✅ 등록 완료 {result.success}개</p>
          {result.skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}개</p>}
          {(result.errors ?? []).map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
        </div>
      )}

      <ModalFooter>
        <button onClick={onClose} className={`${btnCls} bg-gray-700 hover:bg-gray-600`}>닫기</button>
        {!result && (
          <button onClick={handleSave} disabled={saving || validCount === 0} className={btnCls}>
            {saving ? '등록 중...' : `+ ${validCount}개 로케이션 등록`}
          </button>
        )}
      </ModalFooter>
    </div>
  )
}

// ── 공통 UI
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className={`bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl
                       flex flex-col max-h-[92vh] ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalFooter({ children }) {
  return (
    <div className="flex justify-end gap-3 pt-2 border-t border-gray-800 mt-2">
      {children}
    </div>
  )
}

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
const btnCls    = `px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm
                   font-semibold transition-colors disabled:opacity-40`
