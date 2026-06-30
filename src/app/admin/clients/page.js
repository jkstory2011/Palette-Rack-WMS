'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const EMPTY = {
  name: '', code: '', ceo: '', business_no: '',
  email: '', main_phone: '', contact: '', phone: '', note: '',
}

async function generateNextCode() {
  const { count } = await supabase
    .from('clients').select('*', { count: 'exact', head: true })
  return `CL-${String((count ?? 0) + 1).padStart(3, '0')}`
}

export default function ClientsPage() {
  const [clients, setClients]           = useState([])
  const [form, setForm]                 = useState(EMPTY)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [editForm, setEditForm]         = useState({})
  const [showExcelModal, setShowExcelModal] = useState(false)

  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data ?? [])
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  // 폼 초기화 시 코드 자동생성
  const resetForm = useCallback(async () => {
    const code = await generateNextCode()
    setForm({ ...EMPTY, code })
  }, [])

  useEffect(() => { resetForm() }, [resetForm])

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('화주사명은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('clients').insert({
      name:        form.name.trim(),
      code:        form.code.trim()        || null,
      ceo:         form.ceo.trim()         || null,
      business_no: form.business_no.trim() || null,
      email:       form.email.trim()       || null,
      main_phone:  form.main_phone.trim()  || null,
      contact:     form.contact.trim()     || null,
      phone:       form.phone.trim()       || null,
      note:        form.note.trim()        || null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 화주사명 또는 코드입니다.' : err.message)
    await fetchClients()
    resetForm()
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({
      name: c.name, code: c.code ?? '', ceo: c.ceo ?? '',
      business_no: c.business_no ?? '', email: c.email ?? '',
      main_phone: c.main_phone ?? '', contact: c.contact ?? '',
      phone: c.phone ?? '', note: c.note ?? '',
    })
  }

  async function handleEditSave(c) {
    if (!editForm.name.trim()) return
    const { error: err } = await supabase.from('clients').update({
      name:        editForm.name.trim(),
      code:        editForm.code.trim()        || null,
      ceo:         editForm.ceo.trim()         || null,
      business_no: editForm.business_no.trim() || null,
      email:       editForm.email.trim()       || null,
      main_phone:  editForm.main_phone.trim()  || null,
      contact:     editForm.contact.trim()     || null,
      phone:       editForm.phone.trim()       || null,
      note:        editForm.note.trim()        || null,
    }).eq('id', c.id)
    if (err) { alert(err.code === '23505' ? '이미 존재하는 화주사명 또는 코드입니다.' : err.message); return }
    setEditingId(null); fetchClients()
  }

  async function handleDelete(c) {
    if (!confirm(`'${c.name}' 화주사를 삭제할까요?`)) return
    await supabase.from('clients').delete().eq('id', c.id)
    fetchClients()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">Administration</p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">화주사 관리</h1>
      </div>

      {/* ── 등록 폼 */}
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">신규 화주사 등록</h2>

        {/* 1행: 화주사명·거래처코드·대표자·사업자번호 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FI label="화주사명 *"  placeholder="(주)OO물류"       value={form.name}        onChange={set('name')} />
          <div className="flex flex-col gap-1.5">
            <label className="wms-label">거래처코드 <span className="text-gray-600 font-normal normal-case tracking-normal">(자동생성)</span></label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder="CL-001" className="wms-input font-mono" />
          </div>
          <FI label="대표자"      placeholder="홍길동"            value={form.ceo}         onChange={set('ceo')} />
          <FI label="사업자번호"   placeholder="000-00-00000"     value={form.business_no} onChange={set('business_no')} />
        </div>

        {/* 2행: 전자우편·대표번호·담당자·연락처 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FI label="전자우편"    placeholder="info@company.com"  value={form.email}       onChange={set('email')} />
          <FI label="대표번호"    placeholder="02-0000-0000"      value={form.main_phone}  onChange={set('main_phone')} />
          <FI label="담당자"      placeholder="김담당"             value={form.contact}     onChange={set('contact')} />
          <FI label="연락처"      placeholder="010-0000-0000"     value={form.phone}       onChange={set('phone')} />
        </div>

        {/* 3행: 취급상품/비고 (full width) */}
        <div className="flex flex-col gap-1.5">
          <label className="wms-label">취급상품 / 비고</label>
          <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="굿즈, 올리브유 등" className="wms-input" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-between">
          <button type="button" onClick={() => setShowExcelModal(true)}
            className="px-8 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600
                       text-white font-semibold transition-colors flex items-center gap-2">
            📊 엑셀 일괄등록
          </button>
          <button type="submit" disabled={saving} className="wms-btn wms-btn-primary px-8">
            {saving ? '등록 중...' : '+ 화주사 등록'}
          </button>
        </div>
      </form>

      {/* ── 목록 */}
      <div className="wms-card overflow-x-auto">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          화주사 목록 <span className="text-gray-600">({clients.length}개)</span>
        </h2>
        {clients.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 화주사가 없습니다.</p>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left border-b border-white/[0.08]">
                {['화주사명','코드','대표자','사업자번호','전자우편','대표번호','담당자','연락처','취급상품/비고',''].map((h,i) => (
                  <th key={i} className="pb-2.5 wms-label pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {clients.map(c => editingId === c.id ? (
                <tr key={c.id} className="bg-blue-950/30">
                  {['name','code','ceo','business_no','email','main_phone','contact','phone','note'].map((k, i) => (
                    <td key={k} className="py-1.5 pr-2">
                      <input value={editForm[k]}
                        onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                        className="wms-input py-1.5 text-xs w-full min-w-[80px]"
                        autoFocus={i === 0}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(c)} />
                    </td>
                  ))}
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => handleEditSave(c)}
                      className="text-xs text-[#F59E0B] hover:text-[#FBBF24] font-semibold px-2 py-1">저장</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1">취소</button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="hover:bg-white/[0.025] transition-colors group">
                  <td className="py-3 font-semibold text-white pr-3">{c.name}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs pr-3">{c.code ?? '—'}</td>
                  <td className="py-3 text-gray-300 pr-3">{c.ceo ?? '—'}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs pr-3">{c.business_no ?? '—'}</td>
                  <td className="py-3 text-gray-400 text-xs pr-3">{c.email ?? '—'}</td>
                  <td className="py-3 text-gray-400 pr-3">{c.main_phone ?? '—'}</td>
                  <td className="py-3 text-gray-300 pr-3">{c.contact ?? '—'}</td>
                  <td className="py-3 text-gray-400 pr-3">{c.phone ?? '—'}</td>
                  <td className="py-3 text-gray-500 text-xs pr-3">{c.note ?? '—'}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(c)}
                      className="text-xs text-gray-600 hover:text-[#FBBF24] transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">수정</button>
                    <button onClick={() => handleDelete(c)}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 opacity-0 group-hover:opacity-100">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showExcelModal && (
        <ClientExcelModal
          onClose={() => setShowExcelModal(false)}
          onSuccess={() => { setShowExcelModal(false); fetchClients(); resetForm() }}
        />
      )}
    </div>
  )
}

/* ── 엑셀 일괄등록 모달 */
function ClientExcelModal({ onClose, onSuccess }) {
  const fileRef = useRef(null)
  const [rows, setRows]             = useState([])
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState(null)
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['화주사명*','거래처코드','대표자','사업자번호','전자우편','대표번호','담당자','연락처','취급상품/비고'],
      ['(주)샘플물류','CL-001','홍길동','123-45-67890','info@sample.com','02-1234-5678','김담당','010-1234-5678','굿즈, 음료'],
    ])
    ws['!cols'] = [20,14,10,16,22,14,10,14,20].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '화주사목록')
    XLSX.writeFile(wb, '화주사등록양식.xlsx')
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
        _row:        i + 2,
        name:        String(r[0] ?? '').trim(),
        code:        String(r[1] ?? '').trim() || null,
        ceo:         String(r[2] ?? '').trim() || null,
        business_no: String(r[3] ?? '').trim() || null,
        email:       String(r[4] ?? '').trim() || null,
        main_phone:  String(r[5] ?? '').trim() || null,
        contact:     String(r[6] ?? '').trim() || null,
        phone:       String(r[7] ?? '').trim() || null,
        note:        String(r[8] ?? '').trim() || null,
        _valid:      !!String(r[0] ?? '').trim(),
      })))
    } catch (err) {
      setParseError('파일을 읽는 중 오류가 발생했습니다: ' + err.message)
    }
  }

  async function handleImport() {
    const valid = rows.filter(r => r._valid); if (!valid.length) return
    setImporting(true)
    let success = 0, skipped = 0; const errors = []

    // 코드 없는 행은 자동생성
    const { count: base } = await supabase.from('clients').select('*', { count: 'exact', head: true })
    let autoIdx = (base ?? 0) + 1

    for (const row of valid) {
      const code = row.code || `CL-${String(autoIdx).padStart(3, '0')}`
      const { error } = await supabase.from('clients').insert({
        name: row.name, code, ceo: row.ceo, business_no: row.business_no,
        email: row.email, main_phone: row.main_phone,
        contact: row.contact, phone: row.phone, note: row.note,
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

  const COLS = ['화주사명','코드','대표자','사업자번호','전자우편','대표번호','담당자','연락처','취급상품/비고']
  const KEYS = ['name','code','ceo','business_no','email','main_phone','contact','phone','note']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-5xl shadow-2xl max-h-[90vh] flex flex-col"
           style={{background:'linear-gradient(135deg,rgba(15,20,40,0.98) 0%,rgba(8,12,24,0.99) 100%)',border:'1px solid rgba(255,255,255,0.10)'}}
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-6" style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <h2 className="text-lg font-bold text-white">📊 화주사 엑셀 일괄등록</h2>
            <p className="text-xs text-slate-500 mt-1">양식을 다운로드해 작성 후 업로드하세요. 거래처코드 미입력 시 자동생성됩니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* ① 양식 다운로드 */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-300 mb-1">① 양식 다운로드</p>
              <p className="text-xs text-gray-500">열 순서: 화주사명* / 거래처코드 / 대표자 / 사업자번호 / 전자우편 / 대표번호 / 담당자 / 연락처 / 취급상품·비고</p>
            </div>
            <button onClick={downloadTemplate} className="wms-btn wms-btn-ghost whitespace-nowrap">
              ⬇ 양식 다운로드
            </button>
          </div>

          <div className="border-t border-gray-800" />

          {/* ② 파일 업로드 */}
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-3">② 파일 업로드</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <p className="text-gray-400 text-sm">클릭하여 파일 선택 (.xlsx, .xls)</p>
              <p className="text-gray-600 text-xs mt-1">또는 파일을 이 영역으로 드래그</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
            {parseError && <p className="text-red-400 text-sm mt-2">{parseError}</p>}
          </div>

          {/* ③ 미리보기 */}
          {rows.length > 0 && !result && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-300">③ 미리보기</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400">유효 {validCount}건</span>
                  {invalidCount > 0 && <span className="text-red-400">화주사명 누락 {invalidCount}건 (건너뜀)</span>}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-64">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr className="text-gray-400">
                      <th className="px-3 py-2 text-left font-medium w-10">행</th>
                      {COLS.map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                      <th className="px-3 py-2 text-center font-medium w-12">상태</th>
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

          {/* 결과 */}
          {result && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
              <p className="text-emerald-400 font-bold">✅ 등록 성공 {result.success}건</p>
              {result.skipped > 0 && <p className="text-yellow-400">⚠ 중복 건너뜀 {result.skipped}건</p>}
              {result.errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {!result && (
          <div className="p-6 flex justify-end gap-3" style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            <button onClick={onClose} className="wms-btn wms-btn-ghost px-6">닫기</button>
            <button onClick={handleImport}
              disabled={importing || validCount === 0}
              className="wms-btn wms-btn-primary px-8">
              {importing ? '등록 중...' : `+ ${validCount}개 화주사 등록`}
            </button>
          </div>
        )}
        {result && (
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
