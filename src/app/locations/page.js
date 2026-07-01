'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/context/CompanyContext'

const TABS = { ZONE: 'zone', PALLET: 'pallet', PRODUCT: 'product' }

export default function LocationsPage() {
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return TABS.ZONE
    return new URLSearchParams(window.location.search).get('tab') || TABS.ZONE
  })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">구역 / 로케이션 관리</h1>

      <div className="flex gap-2 border-b border-white/10">
        {[
          { key: TABS.ZONE,    label: '구역(Zone)' },
          { key: TABS.PALLET,  label: '파렛트랙 로케이션' },
          { key: TABS.PRODUCT, label: '🗂 상품 로케이션' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors ${
              tab === key
                ? 'bg-white/[0.06] text-white border border-b-0 border-white/15'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === TABS.ZONE    && <ZoneTab />}
      {tab === TABS.PALLET  && <PalletLocationTab />}
      {tab === TABS.PRODUCT && <ProductLocationTab />}
    </div>
  )
}


// ════════════════════════════════════════
// 구역 탭
// ════════════════════════════════════════
function ZoneTab() {
  const [zones, setZones]           = useState([])
  const [form, setForm]             = useState({ code: '', name: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [showBulk, setShowBulk]     = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({ code: '', name: '' })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const allCheckRef = useRef(null)
  const { company } = useCompany() ?? {}

  useEffect(() => {
    if (!allCheckRef.current) return
    allCheckRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < zones.length
  }, [selectedIds, zones.length])

  function toggleSelect(id) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === zones.length ? new Set() : new Set(zones.map(z => z.id)))
  }
  async function handleBulkDelete() {
    const ids = [...selectedIds]
    const withLocs  = zones.filter(z => ids.includes(z.id) && (z.locations?.length ?? 0) > 0)
    const canDelete = zones.filter(z => ids.includes(z.id) && !(z.locations?.length > 0))
    if (canDelete.length === 0)
      return alert(`선택한 구역 모두 로케이션이 있어 삭제할 수 없습니다.\n먼저 로케이션을 삭제해주세요.`)
    let msg = `${canDelete.length}개 구역을 삭제할까요?`
    if (withLocs.length > 0) msg += `\n\n⚠ ${withLocs.map(z => z.code).join(', ')}은 로케이션이 있어 제외됩니다.`
    if (!confirm(msg)) return
    for (const z of canDelete) await supabase.from('zones').delete().eq('id', z.id)
    setSelectedIds(new Set()); fetchZones()
  }

  const fetchZones = useCallback(async () => {
    let q = supabase.from('zones').select('id, code, name, locations(id)')
    if (company?.id) q = q.eq('company_id', company.id)
    const { data } = await q.order('code')
    setZones(data ?? [])
  }, [company?.id])

  useEffect(() => { fetchZones() }, [fetchZones])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.code.trim() || !form.name.trim()) return setError('구역코드와 구역명은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('zones')
      .insert({ code: form.code.trim().toUpperCase(), name: form.name.trim(), company_id: company?.id ?? null })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 구역코드입니다.' : err.message)
    setForm({ code: '', name: '' }); fetchZones()
  }

  function startEdit(zone) {
    setEditingId(zone.id)
    setEditForm({ code: zone.code, name: zone.name })
  }

  async function handleEditSave(zone) {
    if (!editForm.code.trim() || !editForm.name.trim()) return
    const { error: err } = await supabase.from('zones')
      .update({ code: editForm.code.trim().toUpperCase(), name: editForm.name.trim() })
      .eq('id', zone.id)
    if (err) { alert(err.code === '23505' ? '이미 존재하는 구역코드입니다.' : err.message); return }
    setEditingId(null); fetchZones()
  }

  async function handleDelete(zone) {
    if (zone.locations?.length > 0)
      return alert(`⚠️ ${zone.locations.length}개의 로케이션이 있습니다. 먼저 로케이션을 삭제하세요.`)
    if (!confirm(`'${zone.code}' 구역을 삭제할까요?`)) return
    await supabase.from('zones').delete().eq('id', zone.id); fetchZones()
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400">신규 구역 등록</h2>
          <button type="button" onClick={() => setShowBulk(true)}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
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
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={btnCls}>
            {saving ? '등록 중...' : '+ 구역 추가'}
          </button>
        </div>
      </form>

      <div className="wms-card">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          전체 구역 <span className="text-gray-600">({zones.length}개)</span>
        </h2>
        {zones.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 구역이 없습니다.</p>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-red-950/40 border border-red-700/40
                              rounded-xl px-4 py-2 mb-3">
                <span className="text-sm text-red-300 font-semibold">{selectedIds.size}개 선택됨</span>
                <button onClick={handleBulkDelete}
                  className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  🗑 선택 삭제
                </button>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 w-8">
                    <input type="checkbox" ref={allCheckRef}
                      checked={zones.length > 0 && selectedIds.size === zones.length}
                      onChange={toggleAll} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                  </th>
                  <th className="pb-2.5 wms-label">코드</th><th className="pb-2.5 wms-label">이름</th>
                  <th className="pb-2.5 wms-label text-center">로케이션 수</th><th className="pb-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {zones.map(z => editingId === z.id ? (
                  <tr key={z.id} className="bg-blue-950/30">
                    <td className="py-2" />
                    <td className="py-2 pr-2">
                      <input value={editForm.code}
                        onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                        className={`${inputCls} py-1.5 text-sm font-bold w-24`}
                        autoFocus onKeyDown={e => e.key === 'Enter' && handleEditSave(z)} />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className={`${inputCls} py-1.5 text-sm w-full`}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(z)} />
                    </td>
                    <td className="py-2 text-center text-gray-400">{z.locations?.length ?? 0}개</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => handleEditSave(z)}
                        className="text-xs text-[#F59E0B] hover:text-[#FBBF24] font-semibold px-2 py-1">저장</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1">취소</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={z.id}
                    className={`hover:bg-white/[0.025] transition-colors group ${selectedIds.has(z.id) ? 'bg-blue-950/20' : ''}`}>
                    <td className="py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(z.id)} onChange={() => toggleSelect(z.id)}
                        className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    </td>
                    <td className="py-3 font-bold text-white text-lg">{z.code}</td>
                    <td className="py-3 text-gray-300">{z.name}</td>
                    <td className="py-3 text-center text-gray-400">{z.locations?.length ?? 0}개</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(z)}
                        className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
                      <button onClick={() => handleDelete(z)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showBulk && (
        <BulkZoneModal onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); fetchZones() }} />
      )}
    </div>
  )
}

function BulkZoneModal({ onClose, onSuccess }) {
  const [text, setText]       = useState('')
  const [preview, setPreview] = useState([])
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    setPreview(text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,\t]/)
      const code = (parts[0] ?? '').trim().toUpperCase()
      const name = (parts[1] ?? '').trim()
      return { code, name, valid: !!code && !!name }
    }))
  }, [text])

  async function handleSave() {
    const rows = preview.filter(r => r.valid)
    if (!rows.length) return
    setSaving(true)
    let success = 0, skipped = 0; const errors = []
    for (const row of rows) {
      const { error } = await supabase.from('zones').insert({ code: row.code, name: row.name })
      if (!error) success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setSaving(false); setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  const validCount = preview.filter(r => r.valid).length

  return (
    <Modal title="구역 일괄 추가" onClose={onClose}>
      <div className="space-y-4">
        <HintBox title="입력 형식" lines={['한 줄에 구역코드, 구역이름 (쉼표 구분)', 'A, A동 일반구역', 'B, B동 냉동구역']} />
        <Field label="구역 목록 입력">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7}
            placeholder={'A, A동 일반구역\nB, B동 냉동구역'} className={textareaCls} />
        </Field>
        {preview.length > 0 && !result && (
          <PreviewTable
            headers={['코드', '이름', '상태']}
            rows={preview.map(r => [
              <span key="c" className="font-mono font-bold text-white">{r.code || <span className="text-red-400">없음</span>}</span>,
              r.name || <span className="text-red-400">없음</span>,
              r.valid ? <span key="v" className="text-green-400">✓</span> : <span key="v" className="text-red-400">✗</span>,
            ])}
            validCount={validCount} total={preview.length} />
        )}
        {result && <ResultBox {...result} />}
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
// 파렛트랙 로케이션 탭
// ════════════════════════════════════════
function PalletLocationTab() {
  const [zones, setZones]           = useState([])
  const [zoneId, setZoneId]         = useState('')
  const [locations, setLocations]   = useState([])
  const [form, setForm]             = useState({ code: '', grid_x: '', grid_y: '', aisle: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [showBulk, setShowBulk]     = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({ code: '', grid_x: '', grid_y: '', aisle: '' })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const allCheckRef = useRef(null)
  const { company } = useCompany() ?? {}

  useEffect(() => {
    if (!allCheckRef.current) return
    allCheckRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < locations.length
  }, [selectedIds, locations.length])

  function toggleSelect(id) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === locations.length ? new Set() : new Set(locations.map(l => l.id)))
  }
  const activePallets = (loc) =>
    (loc.pallets ?? []).filter(p => p.status === 'stored' || p.status === 'pending').length

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    const withPallets  = locations.filter(l => ids.includes(l.id) && activePallets(l) > 0)
    const canDelete    = locations.filter(l => ids.includes(l.id) && activePallets(l) === 0)
    if (canDelete.length === 0)
      return alert('선택한 로케이션 모두 파렛트가 있어 삭제할 수 없습니다.')
    let msg = `${canDelete.length}개 로케이션을 삭제할까요?`
    if (withPallets.length > 0) msg += `\n\n⚠ ${withPallets.map(l => l.code).join(', ')}은 파렛트가 있어 제외됩니다.`
    if (!confirm(msg)) return
    for (const l of canDelete) await supabase.from('locations').delete().eq('id', l.id)
    setSelectedIds(new Set()); fetchLocations(zoneId)
  }

  useEffect(() => {
    let q = supabase.from('zones').select('id, code, name')
    if (company?.id) q = q.eq('company_id', company.id)
    q.order('code').then(({ data }) => setZones(data ?? []))
  }, [company?.id])

  const fetchLocations = useCallback(async (id) => {
    if (!id) { setLocations([]); return }
    const { data } = await supabase.from('locations')
      .select('id, code, grid_x, grid_y, aisle, is_active, pallets(id, status)')
      .eq('zone_id', id).order('grid_y').order('grid_x')
    // pallets 배열에 status 포함 → 활성 수량 계산용
    setLocations(data ?? [])
  }, [])

  useEffect(() => { fetchLocations(zoneId) }, [zoneId, fetchLocations])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!zoneId)                       return setError('구역을 먼저 선택하세요.')
    if (!form.code.trim())             return setError('로케이션 코드를 입력하세요.')
    if (!form.grid_x || !form.grid_y) return setError('격자 좌표(X열, Y행)를 입력하세요.')
    setSaving(true)
    const { error: err } = await supabase.from('locations').insert({
      zone_id: Number(zoneId), code: form.code.trim().toUpperCase(),
      grid_x: Number(form.grid_x), grid_y: Number(form.grid_y),
      aisle: form.aisle.trim() || null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 같은 코드 또는 좌표가 존재합니다.' : err.message)
    setForm({ code: '', grid_x: '', grid_y: '', aisle: '' }); fetchLocations(zoneId)
  }

  function startEdit(loc) {
    setEditingId(loc.id)
    setEditForm({ code: loc.code, grid_x: loc.grid_x, grid_y: loc.grid_y, aisle: loc.aisle ?? '' })
  }

  async function handleEditSave(loc) {
    if (!editForm.code.trim() || !editForm.grid_x || !editForm.grid_y) return
    const { error: err } = await supabase.from('locations')
      .update({ code: editForm.code.trim().toUpperCase(), grid_x: Number(editForm.grid_x),
                grid_y: Number(editForm.grid_y), aisle: editForm.aisle.trim() || null })
      .eq('id', loc.id)
    if (err) { alert(err.code === '23505' ? '이미 같은 코드 또는 좌표가 존재합니다.' : err.message); return }
    setEditingId(null); fetchLocations(zoneId)
  }

  async function handleToggleActive(loc) {
    await supabase.from('locations').update({ is_active: !loc.is_active }).eq('id', loc.id)
    fetchLocations(zoneId)
  }

  async function handleDelete(loc) {
    if (activePallets(loc) > 0)
      return alert(`⚠️ 이 로케이션에 파렛트 ${activePallets(loc)}개가 있어 삭제할 수 없습니다.`)
    if (!confirm(`'${loc.code}' 로케이션을 삭제할까요?`)) return
    await supabase.from('locations').delete().eq('id', loc.id); fetchLocations(zoneId)
  }

  const maxX   = locations.length > 0 ? Math.max(...locations.map(l => l.grid_x)) : 0
  const maxY   = locations.length > 0 ? Math.max(...locations.map(l => l.grid_y)) : 0
  const locMap = new Map(locations.map(l => [`${l.grid_x}-${l.grid_y}`, l]))

  return (
    <div className="space-y-5">
      <div className="wms-card">
        <label className="block text-xs font-medium text-gray-400 mb-2">구역 선택</label>
        <select value={zoneId} onChange={e => { setZoneId(e.target.value); setEditingId(null); setSelectedIds(new Set()) }} className={selectCls}>
          <option value="">구역을 선택하세요...</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
        </select>
      </div>

      {zoneId && (
        <>
          {locations.length > 0 && (
            <div className="wms-card overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">현재 격자 구성 ({locations.length}개 로케이션)</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900/40 border border-blue-700 inline-block" /> 공 (0개)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-900/50 border border-amber-600 inline-block" /> 일부 적재</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/50 border border-red-600 inline-block" /> 만적 (8개)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 border border-gray-700 inline-block" /> 비활성</span>
                </div>
              </div>
              <div className="inline-grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${maxX}, minmax(56px, 1fr))` }}>
                {Array.from({ length: maxY }, (_, r) =>
                  Array.from({ length: maxX }, (_, c) => {
                    const loc       = locMap.get(`${c+1}-${r+1}`)
                    const pCount    = loc ? activePallets(loc) : 0
                    const colorCls  = !loc
                      ? 'border-dashed border-gray-700 text-gray-700'
                      : !loc.is_active
                        ? 'bg-gray-800 border-gray-700 text-gray-600'
                        : pCount === 0
                          ? 'bg-blue-900/40 border-blue-700 text-[#F59E0B]/80'
                          : pCount >= 8
                            ? 'bg-red-900/50 border-red-600 text-red-200'
                            : 'bg-amber-900/50 border-amber-600 text-amber-200'
                    return (
                      <div key={`${c}-${r}`}
                        className={`h-11 rounded-lg text-[9px] font-bold flex flex-col items-center
                                    justify-center border transition-colors ${colorCls}`}>
                        <span>{loc ? loc.code : `${c+1},${r+1}`}</span>
                        {loc && pCount > 0 && (
                          <span className="text-[8px] opacity-80 mt-0.5">{pCount}개</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-[10px] text-gray-700 mt-2">← X(열) 방향 / ↓ Y(행) 방향</p>
            </div>
          )}

          <form onSubmit={handleAdd} className="wms-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400">로케이션 추가</h2>
              <button type="button" onClick={() => setShowBulk(true)}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
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
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={btnCls}>
                {saving ? '등록 중...' : '+ 로케이션 추가'}
              </button>
            </div>
          </form>

          <div className="wms-card">
            <h2 className="text-sm font-semibold text-gray-400 mb-4">
              로케이션 목록 <span className="text-gray-600">({locations.length}개)</span>
            </h2>
            {locations.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">이 구역에 등록된 로케이션이 없습니다.</p>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between bg-red-950/40 border border-red-700/40
                                  rounded-xl px-4 py-2 mb-3">
                    <span className="text-sm text-red-300 font-semibold">{selectedIds.size}개 선택됨</span>
                    <button onClick={handleBulkDelete}
                      className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                      🗑 선택 삭제
                    </button>
                  </div>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 w-8">
                        <input type="checkbox" ref={allCheckRef}
                          checked={locations.length > 0 && selectedIds.size === locations.length}
                          onChange={toggleAll} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                      </th>
                      <th className="pb-2.5 wms-label">코드</th><th className="pb-2.5 wms-label text-center">X(열)</th>
                      <th className="pb-2.5 wms-label text-center">Y(행)</th><th className="pb-2.5 wms-label">통로</th>
                      <th className="pb-2.5 wms-label text-center">파렛트</th>
                      <th className="pb-2.5 wms-label text-center">슬롯</th>
                      <th className="pb-2.5 wms-label text-center">상태</th>
                      <th className="pb-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {locations.map(l => editingId === l.id ? (
                      <tr key={l.id} className="bg-blue-950/30">
                        <td className="py-1.5" />
                        <td className="py-1.5 pr-1">
                          <input value={editForm.code}
                            onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                            className={`${inputCls} py-1 text-xs font-mono font-bold w-24`} autoFocus />
                        </td>
                        <td className="py-1.5 pr-1 text-center">
                          <input type="number" min="1" value={editForm.grid_x}
                            onChange={e => setEditForm(f => ({ ...f, grid_x: e.target.value }))}
                            className={`${inputCls} py-1 text-xs text-center w-14`} />
                        </td>
                        <td className="py-1.5 pr-1 text-center">
                          <input type="number" min="1" value={editForm.grid_y}
                            onChange={e => setEditForm(f => ({ ...f, grid_y: e.target.value }))}
                            className={`${inputCls} py-1 text-xs text-center w-14`} />
                        </td>
                        <td className="py-1.5 pr-1">
                          <input value={editForm.aisle}
                            onChange={e => setEditForm(f => ({ ...f, aisle: e.target.value }))}
                            placeholder="통로" className={`${inputCls} py-1 text-xs w-24`}
                            onKeyDown={e => e.key === 'Enter' && handleEditSave(l)} />
                        </td>
                        <td className="py-1.5 text-center text-gray-400">{activePallets(l)}</td>
                        <td className="py-1.5 text-center">
                          <select value={l.slot_config || 'both'}
                            onChange={async e => {
                              await supabase.from('locations').update({ slot_config: e.target.value }).eq('id', l.id)
                              fetchLocations(zoneId)
                            }}
                            className="wms-select py-1 px-2 text-xs rounded-lg w-28"
                            onClick={e => e.stopPropagation()}>
                            <option value="both">좌우 모두</option>
                            <option value="L">좌측만</option>
                            <option value="R">우측만</option>
                          </select>
                        </td>
                        <td className="py-1.5 text-center">
                          <button onClick={() => handleToggleActive(l)}
                            className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
                              l.is_active ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                            {l.is_active ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => handleEditSave(l)}
                            className="text-xs text-[#F59E0B] hover:text-[#FBBF24] font-semibold px-2 py-1">저장</button>
                          <button onClick={() => setEditingId(null)}
                            className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1">취소</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={l.id}
                        className={`hover:bg-white/[0.025] transition-colors group ${selectedIds.has(l.id) ? 'bg-blue-950/20' : ''}`}>
                        <td className="py-2.5">
                          <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)}
                            className="w-4 h-4 accent-blue-500 cursor-pointer" />
                        </td>
                        <td className="py-2.5 font-bold text-white font-mono">{l.code}</td>
                        <td className="py-2.5 text-center text-gray-400">{l.grid_x}</td>
                        <td className="py-2.5 text-center text-gray-400">{l.grid_y}</td>
                        <td className="py-2.5 text-gray-500 text-xs">{l.aisle ?? '—'}</td>
                        <td className="py-2.5 text-center text-gray-400">{activePallets(l)}</td>
                        <td className="py-2.5 text-center">
                          {(!l.slot_config || l.slot_config === 'both')
                            ? <span className="text-xs text-gray-600">좌우</span>
                            : <span className="text-xs font-semibold text-red-400">
                                {l.slot_config === 'L' ? '좌측만' : '우측만'}
                              </span>}
                        </td>
                        <td className="py-2.5 text-center">
                          <button onClick={() => handleToggleActive(l)}
                            className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
                              l.is_active
                                ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                                : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}>
                            {l.is_active ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <button onClick={() => startEdit(l)}
                            className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
                          <button onClick={() => handleDelete(l)}
                            className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
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
          onSuccess={() => { setShowBulk(false); fetchLocations(zoneId) }} />
      )}
    </div>
  )
}

function BulkLocationModal({ zoneId, zoneName, existingCodes, existingSlots, onClose, onSuccess }) {
  const [mode, setMode] = useState('pattern')

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <Modal title={`🔢 파렛트 로케이션 일괄 추가 — ${zoneName}구역`} onClose={onClose} wide>
      <div className="flex gap-2 mb-5">
        {[{ key: 'pattern', label: '🔢 패턴 자동 생성' }, { key: 'text', label: '✏️ 직접 입력' }]
          .map(({ key, label }) => (
            <button key={key} onClick={() => setMode(key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                mode === key ? 'bg-[#F59E0B] text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
      </div>
      {mode === 'pattern'
        ? <PatternMode zoneId={zoneId} zoneCode={zoneName} existingCodes={existingCodes} existingSlots={existingSlots} onClose={onClose} onSuccess={onSuccess} />
        : <TextMode    zoneId={zoneId}                     existingCodes={existingCodes}                                onClose={onClose} onSuccess={onSuccess} />}
    </Modal>
  )
}

function PatternMode({ zoneId, zoneCode, existingCodes, existingSlots, onClose, onSuccess }) {
  const [cfg, setCfg] = useState({ prefix: zoneCode ? `${zoneCode}-` : '', startNo: 1, endNo: 10, padding: 2, cols: 5, startX: 1, startY: 1, aisle: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }))

  const generated = useMemo(() => {
    const rows = []; const total = Number(cfg.endNo) - Number(cfg.startNo) + 1
    if (total <= 0 || total > 500) return rows
    for (let i = 0; i < total; i++) {
      const no   = Number(cfg.startNo) + i
      const code = `${cfg.prefix}${String(no).padStart(Number(cfg.padding), '0')}`
      const col  = i % Number(cfg.cols), row = Math.floor(i / Number(cfg.cols))
      const x = Number(cfg.startX) + col, y = Number(cfg.startY) + row
      const skip = existingCodes.has(code) || existingSlots.has(`${x}-${y}`)
      rows.push({ code, x, y, aisle: cfg.aisle || null, skip })
    }
    return rows
  }, [cfg, existingCodes, existingSlots])

  const newCount  = generated.filter(r => !r.skip).length
  const skipCount = generated.filter(r =>  r.skip).length
  const pCols = Number(cfg.cols)
  const pRows = Math.min(Math.ceil(generated.length / pCols), 6)

  async function handleSave() {
    const rows = generated.filter(r => !r.skip)
    if (!rows.length) return
    setSaving(true)
    let success = 0
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('locations').insert(
        rows.slice(i, i + 50).map(r => ({
          zone_id: Number(zoneId), code: r.code.toUpperCase(),
          grid_x: r.x, grid_y: r.y, aisle: r.aisle,
        }))
      )
      if (!error) success += Math.min(50, rows.length - i)
    }
    setSaving(false); setResult({ success, skipped: skipCount })
    if (success > 0) onSuccess()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['코드 접두사',    'prefix',  'text',   'A-'],
          ['시작 번호',      'startNo', 'number', '1'],
          ['끝 번호',        'endNo',   'number', '10'],
          ['번호 자릿수',    'padding', 'number', '2'],
          ['열 개수 (가로)', 'cols',    'number', '5'],
          ['시작 X 좌표',    'startX',  'number', '1'],
          ['시작 Y 좌표',    'startY',  'number', '1'],
          ['공통 통로',      'aisle',   'text',   '1번 통로'],
        ].map(([label, key, type, ph]) => (
          <Field key={key} label={label}>
            <input type={type} value={cfg[key]}
              onChange={e => set(key, e.target.value)}
              placeholder={ph} min={type === 'number' ? '1' : undefined}
              className={inputCls} />
          </Field>
        ))}
      </div>

      {generated.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-gray-400">생성 예정:</span>
            <span className="text-white font-bold">{generated.length}개</span>
            <span className="text-green-400 font-semibold">✓ 신규 {newCount}개</span>
            {skipCount > 0 && <span className="text-yellow-400">⚠ 중복 건너뜀 {skipCount}개</span>}
          </div>
          <div className="w-full grid gap-1"
            style={{ gridTemplateColumns: `repeat(${pCols}, minmax(0, 1fr))` }}>
            {generated.slice(0, pRows * pCols).map((r, i) => {
              const h   = pCols > 22 ? 'h-6' : pCols > 15 ? 'h-7' : 'h-9'
              const txt = pCols > 22 ? 'text-[7px]' : pCols > 15 ? 'text-[8px]' : 'text-[9px]'
              return (
                <div key={i} title={r.code}
                  className={`${h} ${txt} rounded font-bold flex items-center justify-center
                    border truncate px-0.5 ${r.skip
                      ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-600'
                      : 'bg-blue-900/40 border-blue-700 text-[#F59E0B]/80'}`}>
                  {r.code}
                </div>
              )
            })}
          </div>
          {generated.length > pRows * pCols && (
            <p className="text-xs text-gray-600">+ {generated.length - pRows * pCols}개 더...</p>
          )}
        </div>
      )}

      {result && <ResultBox success={result.success} skipped={result.skipped} />}
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

function TextMode({ zoneId, existingCodes, onClose, onSuccess }) {
  const [text, setText]     = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const preview = useMemo(() =>
    text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,\t]/)
      const code  = (parts[0] ?? '').trim().toUpperCase()
      const x = parseInt(parts[1] ?? ''), y = parseInt(parts[2] ?? '')
      const aisle = (parts[3] ?? '').trim() || null
      const dup = existingCodes.has(code)
      const valid = !!code && !isNaN(x) && x > 0 && !isNaN(y) && y > 0 && !dup
      return { code, x, y, aisle, valid, dup }
    }), [text, existingCodes])

  const validCount = preview.filter(r => r.valid).length

  async function handleSave() {
    const rows = preview.filter(r => r.valid)
    if (!rows.length) return
    setSaving(true)
    let success = 0, skipped = 0; const errors = []
    for (const row of rows) {
      const { error } = await supabase.from('locations').insert({
        zone_id: Number(zoneId), code: row.code, grid_x: row.x, grid_y: row.y, aisle: row.aisle,
      })
      if (!error) success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setSaving(false); setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  return (
    <div className="space-y-4">
      <HintBox title="입력 형식" lines={['한 줄에 하나씩: 코드, X열, Y행, 통로(선택)', 'A-01, 1, 1, 1번통로', 'A-02, 2, 1']} />
      <Field label="로케이션 목록 입력">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={7}
          placeholder={'A-01, 1, 1, 1번통로\nA-02, 2, 1'} className={textareaCls} />
      </Field>
      {preview.length > 0 && !result && (
        <PreviewTable
          headers={['코드', 'X', 'Y', '통로', '상태']}
          rows={preview.map(r => [
            <span key="c" className="font-mono font-bold text-white">{r.code || <span className="text-red-400">없음</span>}</span>,
            isNaN(r.x) ? <span key="x" className="text-red-400">?</span> : r.x,
            isNaN(r.y) ? <span key="y" className="text-red-400">?</span> : r.y,
            r.aisle ?? '—',
            r.valid ? <span key="v" className="text-green-400">✓</span> : (r.dup ? <span key="v" className="text-yellow-400">중복</span> : <span key="v" className="text-red-400">✗</span>),
          ])}
          validCount={validCount} total={preview.length} />
      )}
      {result && <ResultBox {...result} />}
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


// ════════════════════════════════════════
// 상품 로케이션 탭
// ════════════════════════════════════════
function ProductLocationTab() {
  const [locs, setLocs]               = useState([])
  const [form, setForm]               = useState({ code: '', name: '', note: '' })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [showBulk, setShowBulk]       = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({ code: '', name: '', note: '' })
  const [expandedId, setExpandedId]   = useState(null)
  const [products, setProducts]       = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())
  const allCheckRef = useRef(null)

  useEffect(() => {
    if (!allCheckRef.current) return
    allCheckRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < locs.length
  }, [selectedIds, locs.length])

  function toggleSelect(id) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAll() {
    setSelectedIds(prev => prev.size === locs.length ? new Set() : new Set(locs.map(l => l.id)))
  }
  async function handleBulkDelete() {
    const ids = [...selectedIds]
    const targets = locs.filter(l => ids.includes(l.id))
    if (!confirm(`${targets.length}개 상품 로케이션을 삭제할까요?\n해당 로케이션이 지정된 상품의 관리 로케이션은 초기화됩니다.`)) return
    for (const loc of targets) {
      await supabase.from('products').update({ mgmt_location: null }).eq('mgmt_location', loc.code)
      await supabase.from('product_locations').delete().eq('id', loc.id)
    }
    setSelectedIds(new Set()); fetchLocs()
  }

  const fetchLocs = useCallback(async () => {
    const { data } = await supabase.from('product_locations')
      .select('id, code, name, note').order('code')
    setLocs(data ?? [])
  }, [])

  useEffect(() => { fetchLocs() }, [fetchLocs])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.code.trim() || !form.name.trim()) return setError('로케이션 코드와 이름은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('product_locations').insert({
      code: form.code.trim().toUpperCase(), name: form.name.trim(), note: form.note.trim() || null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 코드입니다.' : err.message)
    setForm({ code: '', name: '', note: '' }); fetchLocs()
  }

  function startEdit(loc) {
    setEditingId(loc.id)
    setEditForm({ code: loc.code, name: loc.name, note: loc.note ?? '' })
  }

  async function handleEditSave(loc) {
    if (!editForm.code.trim() || !editForm.name.trim()) return
    const { error: err } = await supabase.from('product_locations')
      .update({ code: editForm.code.trim().toUpperCase(), name: editForm.name.trim(), note: editForm.note.trim() || null })
      .eq('id', loc.id)
    if (err) { alert(err.code === '23505' ? '이미 존재하는 코드입니다.' : err.message); return }
    setEditingId(null); fetchLocs()
  }

  async function handleDelete(loc) {
    if (!confirm(`'${loc.code}' 상품 로케이션을 삭제할까요?\n이 로케이션이 지정된 상품의 관리 로케이션 값은 초기화됩니다.`)) return
    await supabase.from('products').update({ mgmt_location: null }).eq('mgmt_location', loc.code)
    await supabase.from('product_locations').delete().eq('id', loc.id)
    fetchLocs()
  }

  async function toggleExpand(loc) {
    if (expandedId === loc.id) { setExpandedId(null); return }
    setExpandedId(loc.id)
    if (products[loc.code] === undefined) {
      const { data } = await supabase.from('products')
        .select('id, sku, name, client_name')
        .eq('mgmt_location', loc.code).order('name')
      setProducts(p => ({ ...p, [loc.code]: data ?? [] }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-indigo-950/40 border border-indigo-700/50 rounded-xl px-4 py-3 text-xs text-indigo-300">
        상품 마스터의 <span className="font-bold">상품관리 로케이션</span> 필드와 연동됩니다.
        여기서 등록한 코드를 상품 등록 시 입력하면 해당 로케이션으로 분류됩니다.
      </div>

      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400">신규 상품 로케이션 등록</h2>
          <button type="button" onClick={() => setShowBulk(true)}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
            📋 일괄 추가
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="로케이션 코드 *">
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="SHELF-A1" className={inputCls} />
          </Field>
          <Field label="로케이션 이름 *">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="A동 1번 선반" className={inputCls} />
          </Field>
          <Field label="비고 (선택)">
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="냉장 보관 전용" className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={btnCls}>
            {saving ? '등록 중...' : '+ 로케이션 추가'}
          </button>
        </div>
      </form>

      <div className="wms-card">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          상품 로케이션 목록 <span className="text-gray-600">({locs.length}개)</span>
        </h2>
        {locs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 상품 로케이션이 없습니다.</p>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-red-950/40 border border-red-700/40
                              rounded-xl px-4 py-2 mb-3">
                <span className="text-sm text-red-300 font-semibold">{selectedIds.size}개 선택됨</span>
                <button onClick={handleBulkDelete}
                  className="px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  🗑 선택 삭제
                </button>
              </div>
            )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2 w-8">
                  <input type="checkbox" ref={allCheckRef}
                    checked={locs.length > 0 && selectedIds.size === locs.length}
                    onChange={toggleAll} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                </th>
                <th className="pb-2 w-8" />
                <th className="pb-2.5 wms-label">코드</th>
                <th className="pb-2.5 wms-label">이름</th>
                <th className="pb-2.5 wms-label">비고</th>
                <th className="pb-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {locs.flatMap(loc => {
                const isEditing  = editingId  === loc.id
                const isExpanded = expandedId === loc.id
                return [
                  isEditing ? (
                    <tr key={`edit-${loc.id}`} className="bg-blue-950/30">
                      <td /><td />
                      <td className="py-2 pr-2">
                        <input value={editForm.code}
                          onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                          className={`${inputCls} py-1.5 text-sm font-mono font-bold w-28`} autoFocus />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className={`${inputCls} py-1.5 text-sm w-full`} />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={editForm.note}
                          onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="비고" className={`${inputCls} py-1.5 text-sm w-full`}
                          onKeyDown={e => e.key === 'Enter' && handleEditSave(loc)} />
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={() => handleEditSave(loc)}
                          className="text-xs text-[#F59E0B] hover:text-[#FBBF24] font-semibold px-2 py-1">저장</button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1">취소</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`row-${loc.id}`}
                      className={`hover:bg-white/[0.025] transition-colors group ${selectedIds.has(loc.id) ? 'bg-blue-950/20' : ''}`}>
                      <td className="py-3 pl-1">
                        <input type="checkbox" checked={selectedIds.has(loc.id)} onChange={() => toggleSelect(loc.id)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer" />
                      </td>
                      <td className="py-3 pl-1">
                        <button onClick={() => toggleExpand(loc)}
                          className="text-gray-600 hover:text-gray-300 transition-colors text-xs w-6 h-6
                                     flex items-center justify-center rounded">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-3">
                        <span className="font-mono font-bold text-indigo-300 bg-indigo-900/30
                                         px-2 py-0.5 rounded text-sm">{loc.code}</span>
                      </td>
                      <td className="py-3 text-gray-300">{loc.name}</td>
                      <td className="py-3 text-gray-500 text-xs">{loc.note ?? '—'}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(loc)}
                          className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
                        <button onClick={() => handleDelete(loc)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
                      </td>
                    </tr>
                  ),
                  isExpanded && (
                    <tr key={`expand-${loc.id}`}>
                      <td colSpan={6} className="pb-3 px-4">
                        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-2 font-semibold">
                            배정된 상품
                            {products[loc.code] !== undefined && (
                              <span className="ml-2 text-gray-600">({products[loc.code].length}개)</span>
                            )}
                          </p>
                          {products[loc.code] === undefined ? (
                            <p className="text-xs text-gray-600">불러오는 중...</p>
                          ) : products[loc.code].length === 0 ? (
                            <p className="text-xs text-gray-600">배정된 상품이 없습니다.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {products[loc.code].map(p => (
                                <div key={p.id}
                                  className="bg-gray-700/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs">
                                  <span className="text-gray-400 font-mono mr-1">{p.sku}</span>
                                  <span className="text-white">{p.name}</span>
                                  {p.client_name && <span className="text-gray-500 ml-1">({p.client_name})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ].filter(Boolean)
              })}
            </tbody>
          </table>
          </>
        )}
      </div>

      {showBulk && (
        <BulkProductLocationModal
          onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); fetchLocs() }} />
      )}
    </div>
  )
}

function BulkProductLocationModal({ onClose, onSuccess }) {
  const [text, setText]     = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const preview = useMemo(() =>
    text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,\t]/)
      const code = (parts[0] ?? '').trim().toUpperCase()
      const name = (parts[1] ?? '').trim()
      const note = (parts[2] ?? '').trim() || null
      return { code, name, note, valid: !!code && !!name }
    }), [text])

  const validCount = preview.filter(r => r.valid).length

  async function handleSave() {
    const rows = preview.filter(r => r.valid)
    if (!rows.length) return
    setSaving(true)
    let success = 0, skipped = 0; const errors = []
    for (const row of rows) {
      const { error } = await supabase.from('product_locations')
        .insert({ code: row.code, name: row.name, note: row.note })
      if (!error) success++
      else if (error.code === '23505') skipped++
      else errors.push(`${row.code}: ${error.message}`)
    }
    setSaving(false); setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  return (
    <Modal title="상품 로케이션 일괄 추가" onClose={onClose}>
      <div className="space-y-4">
        <HintBox title="입력 형식"
          lines={['한 줄에 코드, 이름, 비고(선택) (쉼표 구분)', 'SHELF-A1, A동 1번 선반, 냉장 전용', 'SHELF-B2, B동 2번 선반']} />
        <Field label="로케이션 목록 입력">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7}
            placeholder={'SHELF-A1, A동 1번 선반, 냉장 전용\nSHELF-B2, B동 2번 선반'}
            className={textareaCls} />
        </Field>
        {preview.length > 0 && !result && (
          <PreviewTable
            headers={['코드', '이름', '비고', '상태']}
            rows={preview.map(r => [
              <span key="c" className="font-mono font-bold text-indigo-300">{r.code || <span className="text-red-400">없음</span>}</span>,
              r.name || <span className="text-red-400">없음</span>,
              r.note ?? '—',
              r.valid ? <span key="v" className="text-green-400">✓</span> : <span key="v" className="text-red-400">✗</span>,
            ])}
            validCount={validCount} total={preview.length} />
        )}
        {result && <ResultBox {...result} />}
      </div>
      <ModalFooter>
        <button onClick={onClose} className={`${btnCls} bg-gray-700 hover:bg-gray-600`}>닫기</button>
        {!result && (
          <button onClick={handleSave} disabled={saving || validCount === 0} className={btnCls}>
            {saving ? '등록 중...' : `+ ${validCount}개 로케이션 등록`}
          </button>
        )}
      </ModalFooter>
    </Modal>
  )
}


// ════════════════════════════════════════
// 공통 UI
// ════════════════════════════════════════
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl flex flex-col max-h-[92vh] ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ children }) {
  return <div className="flex justify-end gap-3 pt-3 mt-3" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>{children}</div>
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="wms-label">{label}</label>
      {children}
    </div>
  )
}

function HintBox({ title, lines }) {
  return (
    <div className="rounded-xl p-3 text-xs text-slate-400 space-y-1"
      style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)'}}>
      <p className="font-semibold text-gray-300">{title}</p>
      {lines.map((l, i) => <p key={i} className={i > 0 ? 'font-mono text-gray-500' : ''}>{l}</p>)}
    </div>
  )
}

function PreviewTable({ headers, rows, validCount, total }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">
        미리보기 — 유효 <span className="text-green-400 font-bold">{validCount}</span>건 /
        오류 <span className="text-red-400">{total - validCount}</span>건
      </p>
      <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto"
        style={{border:'1px solid rgba(255,255,255,0.08)'}}>
        <table className="w-full text-xs">
          <thead className="sticky top-0" style={{background:'rgba(15,20,40,0.98)'}}>
            <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left wms-label">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((cells, i) => (
              <tr key={i}>
                {cells.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-300">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultBox({ success, skipped, errors = [] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
      <p className="text-green-400 font-bold">✅ 등록 성공 {success}건</p>
      {skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {skipped}건</p>}
      {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
    </div>
  )
}

const inputCls    = 'wms-input'
const selectCls   = 'wms-select'
const textareaCls = 'wms-input font-mono resize-none'
const btnCls      = 'wms-btn wms-btn-primary'
