'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/context/CompanyContext'
import { POSITIONS as BASE_POSITIONS } from '@/lib/positions'

const EMPTY = {
  emp_code: '', name: '', department: '', position: '',
  phone: '', email: '', hire_date: '', note: '',
}

const DEPARTMENTS = ['', '관리', '입고팀', '출고팀', '생산팀', '물류팀', '영업팀', '기타']
const POSITIONS   = ['', ...BASE_POSITIONS]

const SETUP_SQL = `-- Supabase SQL Editor에서 실행
CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  emp_code    TEXT UNIQUE,
  name        TEXT NOT NULL,
  department  TEXT,
  position    TEXT,
  phone       TEXT,
  email       TEXT,
  hire_date   DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;`

function formatPhone(v) {
  const d = v.replace(/\D/g, '')
  if (d.startsWith('02')) {
    const n = d.slice(0, 10)
    if (n.length <= 2) return n
    if (n.length <= 6) return `${n.slice(0,2)}-${n.slice(2)}`
    return `${n.slice(0,2)}-${n.slice(2,6)}-${n.slice(6)}`
  }
  const n = d.slice(0, 11)
  if (n.length <= 3) return n
  if (n.length <= 7) return `${n.slice(0,3)}-${n.slice(3)}`
  return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
}

async function generateNextCode() {
  const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true })
  return `EMP-${String((count ?? 0) + 1).padStart(3, '0')}`
}

export default function EmployeesPage() {
  const [employees, setEmployees]   = useState([])
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [search, setSearch]         = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [dbReady, setDbReady]       = useState(true)
  const [copied, setCopied]         = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const { company } = useCompany() ?? {}

  const fetchEmployees = useCallback(async () => {
    let q = supabase.from('employees').select('*')
    if (company?.id) q = q.eq('company_id', company.id)
    const { data, error: err } = await q.order('emp_code')
    if (err?.code === '42P01') { setDbReady(false); return }
    setDbReady(true)
    setEmployees(data ?? [])
  }, [company?.id])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const resetForm = useCallback(async () => {
    const emp_code = await generateNextCode().catch(() => '')
    setForm({ ...EMPTY, emp_code })
  }, [])

  useEffect(() => { resetForm() }, [resetForm])

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('성명은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('employees').insert({
      emp_code:   form.emp_code.trim()   || null,
      name:       form.name.trim(),
      department: form.department        || null,
      position:   form.position          || null,
      phone:      form.phone.trim()      || null,
      email:      form.email.trim()      || null,
      hire_date:  form.hire_date         || null,
      note:       form.note.trim()       || null,
      company_id: company?.id ?? null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 직원코드입니다.' : err.message)
    await fetchEmployees(); resetForm()
  }

  function startEdit(emp) {
    setEditingId(emp.id)
    setEditForm({
      emp_code:   emp.emp_code   ?? '',
      name:       emp.name,
      department: emp.department ?? '',
      position:   emp.position   ?? '',
      phone:      emp.phone      ?? '',
      email:      emp.email      ?? '',
      hire_date:  emp.hire_date  ?? '',
      note:       emp.note       ?? '',
    })
  }

  async function handleEditSave(emp) {
    if (!editForm.name.trim()) return
    const { error: err } = await supabase.from('employees').update({
      emp_code:   editForm.emp_code.trim()   || null,
      name:       editForm.name.trim(),
      department: editForm.department        || null,
      position:   editForm.position          || null,
      phone:      editForm.phone.trim()      || null,
      email:      editForm.email.trim()      || null,
      hire_date:  editForm.hire_date         || null,
      note:       editForm.note.trim()       || null,
    }).eq('id', emp.id)
    if (err) { alert(err.code === '23505' ? '이미 존재하는 직원코드입니다.' : err.message); return }
    setEditingId(null); fetchEmployees()
  }

  async function handleDelete(emp) {
    if (!confirm(`'${emp.name}' 직원을 삭제할까요?`)) return
    await supabase.from('employees').delete().eq('id', emp.id)
    fetchEmployees()
  }

  function copySQL() {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name?.toLowerCase().includes(q) ||
      e.emp_code?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q)
    const matchDept = !deptFilter || e.department === deptFilter
    return matchSearch && matchDept
  })

  if (!dbReady) return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">직원 관리</h1>
      <div className="wms-card space-y-4">
        <p className="text-amber-400 font-semibold text-base">⚙️ DB 테이블 생성 필요</p>
        <p className="text-sm text-gray-400"><strong className="text-white">Supabase → SQL Editor</strong>에서 아래 SQL을 실행해주세요.</p>
        <div className="relative">
          <pre className="bg-black/50 border border-white/10 rounded-xl p-4 pr-20 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{SETUP_SQL}</pre>
          <button onClick={copySQL}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-white/10 hover:bg-white/20 text-gray-300">
            {copied ? '✓ 복사됨' : '복사'}
          </button>
        </div>
        <div className="flex gap-3">
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            Supabase SQL Editor 열기 →
          </a>
          <button onClick={fetchEmployees} className="wms-btn wms-btn-ghost">실행 완료 → 재시도</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">Administration</p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">직원 관리</h1>
      </div>

      {/* ── 등록 폼 */}
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">신규 직원 등록</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 직원코드 */}
          <div className="flex flex-col gap-1.5">
            <label className="wms-label">직원코드 <span className="text-gray-600 font-normal normal-case tracking-normal">(자동)</span></label>
            <input value={form.emp_code} onChange={e => setForm(f => ({ ...f, emp_code: e.target.value }))}
              placeholder="EMP-001" className="wms-input font-mono" />
          </div>
          <FI label="성명 *" placeholder="홍길동" value={form.name} onChange={set('name')} />
          {/* 부서 */}
          <div className="flex flex-col gap-1.5">
            <label className="wms-label">부서</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="wms-select">
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d || '선택'}</option>)}
            </select>
          </div>
          {/* 직책 */}
          <div className="flex flex-col gap-1.5">
            <label className="wms-label">직책</label>
            <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="wms-select">
              {POSITIONS.map(p => <option key={p} value={p}>{p || '선택'}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FI label="연락처" placeholder="010-0000-0000" value={form.phone}
            onChange={v => setForm(f => ({ ...f, phone: formatPhone(v) }))} />
          <FI label="전자우편" placeholder="hong@company.com" value={form.email} onChange={set('email')} />
          <div className="flex flex-col gap-1.5">
            <label className="wms-label">입사일</label>
            <input type="date" value={form.hire_date}
              onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
              className="wms-input" />
          </div>
          <FI label="비고" placeholder="메모" value={form.note} onChange={set('note')} />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-between">
          <button type="button" onClick={() => setShowExcelModal(true)}
            className="px-8 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600
                       text-white font-semibold transition-colors flex items-center gap-2">
            📊 엑셀 일괄등록
          </button>
          <button type="submit" disabled={saving} className="wms-btn wms-btn-primary px-8">
            {saving ? '등록 중...' : '+ 직원 등록'}
          </button>
        </div>
      </form>

      {/* ── 검색/필터 */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름, 코드, 부서 검색..."
          className="wms-input flex-1" />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="wms-select w-36">
          <option value="">전체 부서</option>
          {DEPARTMENTS.filter(Boolean).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* ── 목록 */}
      <div className="wms-card overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          직원 목록 <span className="text-gray-600">({filtered.length}명 / 전체 {employees.length}명)</span>
        </h2>
        {filtered.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 직원이 없습니다.</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left border-b border-white/[0.08]">
                {['직원코드','성명','부서','직책','연락처','전자우편','입사일','비고',''].map((h,i) => (
                  <th key={i} className="pb-2.5 wms-label pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.map(emp => editingId === emp.id ? (
                <tr key={emp.id} className="bg-blue-950/30">
                  <td className="py-1.5 pr-2">
                    <input value={editForm.emp_code}
                      onChange={e => setEditForm(p => ({ ...p, emp_code: e.target.value }))}
                      className="wms-input py-1.5 text-xs font-mono w-full min-w-[80px]" autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(emp)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={editForm.name}
                      onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                      className="wms-input py-1.5 text-xs w-full min-w-[70px]"
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(emp)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select value={editForm.department}
                      onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                      className="wms-select py-1.5 text-xs">
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d || '선택'}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select value={editForm.position}
                      onChange={e => setEditForm(p => ({ ...p, position: e.target.value }))}
                      className="wms-select py-1.5 text-xs">
                      {POSITIONS.map(p => <option key={p} value={p}>{p || '선택'}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={editForm.phone}
                      onChange={e => setEditForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                      className="wms-input py-1.5 text-xs w-full min-w-[110px]"
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(emp)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={editForm.email}
                      onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                      className="wms-input py-1.5 text-xs w-full min-w-[120px]"
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(emp)} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input type="date" value={editForm.hire_date}
                      onChange={e => setEditForm(p => ({ ...p, hire_date: e.target.value }))}
                      className="wms-input py-1.5 text-xs" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={editForm.note}
                      onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                      className="wms-input py-1.5 text-xs w-full min-w-[80px]"
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(emp)} />
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => handleEditSave(emp)}
                      className="text-xs text-[#F59E0B] hover:text-[#FBBF24] font-semibold px-2 py-1">저장</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1">취소</button>
                  </td>
                </tr>
              ) : (
                <tr key={emp.id} className="hover:bg-white/[0.025] transition-colors group">
                  <td className="py-3 text-[#F59E0B] font-mono font-bold text-sm pr-3">{emp.emp_code ?? '—'}</td>
                  <td className="py-3 font-semibold text-white pr-3">{emp.name}</td>
                  <td className="py-3 pr-3">
                    {emp.department
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-gray-300">{emp.department}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-3 pr-3">
                    {emp.position
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">{emp.position}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-3 text-gray-400 pr-3">{emp.phone ?? '—'}</td>
                  <td className="py-3 text-gray-400 text-xs pr-3">{emp.email ?? '—'}</td>
                  <td className="py-3 text-gray-500 text-xs pr-3">
                    {emp.hire_date ? emp.hire_date.slice(0,10) : '—'}
                  </td>
                  <td className="py-3 text-gray-500 text-xs pr-3">{emp.note ?? '—'}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(emp)}
                      className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
                    <button onClick={() => handleDelete(emp)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showExcelModal && (
        <EmpExcelModal
          onClose={() => setShowExcelModal(false)}
          onSuccess={() => { setShowExcelModal(false); fetchEmployees(); resetForm() }}
        />
      )}
    </div>
  )
}

/* ── 엑셀 일괄등록 모달 */
function EmpExcelModal({ onClose, onSuccess }) {
  const fileRef = useRef(null)
  const [rows, setRows]             = useState([])
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState(null)
  const [parseError, setParseError] = useState('')
  const { company } = useCompany() ?? {}

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['직원코드','성명*','부서','직책','연락처','전자우편','입사일(YYYY-MM-DD)','비고'],
      ['EMP-001','홍길동','입고팀','팀장','010-1234-5678','hong@company.com','2024-01-15',''],
      ['EMP-002','김직원','출고팀','사원','010-9876-5432','kim@company.com','2024-03-01',''],
    ])
    ws['!cols'] = [12,10,10,10,14,22,20,14].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '직원목록')
    XLSX.writeFile(wb, '직원등록양식.xlsx')
  }

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    setParseError(''); setRows([]); setResult(null)
    try {
      const XLSX = await import('xlsx')
      const wb  = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
      const data = raw.slice(1).filter(r => r.some(c => String(c).trim()))
      if (!data.length) { setParseError('데이터가 없습니다. 양식을 확인해주세요.'); return }
      setRows(data.map((r, i) => ({
        _row:       i + 2,
        emp_code:   String(r[0] ?? '').trim() || null,
        name:       String(r[1] ?? '').trim(),
        department: String(r[2] ?? '').trim() || null,
        position:   String(r[3] ?? '').trim() || null,
        phone:      String(r[4] ?? '').trim() || null,
        email:      String(r[5] ?? '').trim() || null,
        hire_date:  String(r[6] ?? '').trim() || null,
        note:       String(r[7] ?? '').trim() || null,
        _valid:     !!String(r[1] ?? '').trim(),
      })))
    } catch (err) {
      setParseError('파일을 읽는 중 오류가 발생했습니다: ' + err.message)
    }
  }

  async function handleImport() {
    const valid = rows.filter(r => r._valid); if (!valid.length) return
    setImporting(true)
    let success = 0, skipped = 0; const errors = []
    const { count: base } = await supabase.from('employees').select('*', { count: 'exact', head: true })
    let autoIdx = (base ?? 0) + 1
    for (const row of valid) {
      const emp_code = row.emp_code || `EMP-${String(autoIdx).padStart(3, '0')}`
      const { error } = await supabase.from('employees').insert({
        emp_code, name: row.name, department: row.department,
        position: row.position, phone: row.phone,
        email: row.email, hire_date: row.hire_date || null, note: row.note,
        company_id: company?.id ?? null,
      })
      if (!error) { success++; autoIdx++ }
      else if (error.code === '23505') skipped++
      else errors.push(`${row.name}: ${error.message}`)
    }
    setImporting(false)
    setResult({ success, skipped, errors })
    if (success > 0) onSuccess()
  }

  const validCount   = rows.filter(r => r._valid).length
  const invalidCount = rows.filter(r => !r._valid).length
  const COLS = ['직원코드','성명','부서','직책','연락처','전자우편','입사일','비고']
  const KEYS = ['emp_code','name','department','position','phone','email','hire_date','note']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col"
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <h2 className="text-lg font-bold text-white">📊 직원 엑셀 일괄등록</h2>
            <p className="text-xs text-slate-500 mt-1">직원코드 미입력 시 자동생성됩니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-300 mb-1">① 양식 다운로드</p>
              <p className="text-xs text-gray-500">열 순서: 직원코드 / 성명* / 부서 / 직책 / 연락처 / 전자우편 / 입사일 / 비고</p>
            </div>
            <button onClick={downloadTemplate} className="wms-btn wms-btn-ghost whitespace-nowrap">⬇ 양식 다운로드</button>
          </div>
          <div className="border-t border-gray-800" />
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-3">② 파일 업로드</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <p className="text-gray-400 text-sm">클릭하여 파일 선택 (.xlsx, .xls)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
            {parseError && <p className="text-red-400 text-sm mt-2">{parseError}</p>}
          </div>
          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">③ 미리보기</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-400">유효 {validCount}건</span>
                  {invalidCount > 0 && <span className="text-red-400">성명 누락 {invalidCount}건 (건너뜀)</span>}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-60">
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr className="text-gray-400">
                      <th className="px-3 py-2 text-left w-10">행</th>
                      {COLS.map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
                      <th className="px-3 py-2 text-center w-12">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {rows.map(r => (
                      <tr key={r._row} className={r._valid ? 'hover:bg-gray-800/40' : 'bg-red-900/10'}>
                        <td className="px-3 py-2 text-gray-600">{r._row}</td>
                        {KEYS.map(k => (
                          <td key={k} className="px-3 py-2 text-gray-300">
                            {k === 'name' && !r.name ? <span className="text-red-400">없음</span> : (r[k] ?? '—')}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          {r._valid ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
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
              <p className="text-emerald-400 font-bold">✅ 등록 성공 {result.success}명</p>
              {result.skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}명</p>}
              {result.errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
            </div>
          )}
        </div>
        {!result ? (
          <div className="p-6 flex justify-end gap-3" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            <button onClick={onClose} className="wms-btn wms-btn-ghost px-6">닫기</button>
            <button onClick={handleImport} disabled={importing || validCount === 0} className="wms-btn wms-btn-primary px-8">
              {importing ? '등록 중...' : `+ ${validCount}명 등록`}
            </button>
          </div>
        ) : (
          <div className="p-6 flex justify-end" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            <button onClick={onClose} className="wms-btn wms-btn-ghost px-6">닫기</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FI({ label, placeholder, value, onChange, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="wms-label">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="wms-input" />
    </div>
  )
}
