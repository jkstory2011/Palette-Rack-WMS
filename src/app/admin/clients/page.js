'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const EMPTY = { name: '', code: '', contact: '', phone: '', note: '' }

export default function ClientsPage() {
  const [clients, setClients]     = useState([])
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})
  const [dbReady, setDbReady]     = useState(true)

  const fetchClients = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('clients').select('*').order('name')
    if (err?.code === '42P01') { setDbReady(false); return }
    setClients(data ?? [])
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  async function handleAdd(e) {
    e.preventDefault(); setError('')
    if (!form.name.trim()) return setError('화주사명은 필수입니다.')
    setSaving(true)
    const { error: err } = await supabase.from('clients').insert({
      name:    form.name.trim(),
      code:    form.code.trim()    || null,
      contact: form.contact.trim() || null,
      phone:   form.phone.trim()   || null,
      note:    form.note.trim()    || null,
    })
    setSaving(false)
    if (err) return setError(err.code === '23505' ? '이미 존재하는 화주사명입니다.' : err.message)
    setForm(EMPTY); fetchClients()
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({ name: c.name, code: c.code ?? '', contact: c.contact ?? '', phone: c.phone ?? '', note: c.note ?? '' })
  }

  async function handleEditSave(c) {
    if (!editForm.name.trim()) return
    const { error: err } = await supabase.from('clients')
      .update({
        name:    editForm.name.trim(),
        code:    editForm.code.trim()    || null,
        contact: editForm.contact.trim() || null,
        phone:   editForm.phone.trim()   || null,
        note:    editForm.note.trim()    || null,
      }).eq('id', c.id)
    if (err) { alert(err.code === '23505' ? '이미 존재하는 화주사명입니다.' : err.message); return }
    setEditingId(null); fetchClients()
  }

  async function handleDelete(c) {
    if (!confirm(`'${c.name}' 화주사를 삭제할까요?`)) return
    await supabase.from('clients').delete().eq('id', c.id)
    fetchClients()
  }

  if (!dbReady) return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-3xl font-black text-white tracking-tight leading-none">화주사 관리</h1>
      <div className="wms-card space-y-4">
        <p className="text-amber-400 font-semibold">⚠ clients 테이블이 없습니다.</p>
        <p className="text-sm text-gray-400">Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행하세요.</p>
        <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS clients (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  code       TEXT,
  contact    TEXT,
  phone      TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
        <button onClick={fetchClients}
          className="wms-btn wms-btn-primary">
          재시도
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase font-mono mb-1.5">
          Administration
        </p>
        <h1 className="text-3xl font-black text-white tracking-tight leading-none">화주사 관리</h1>
      </div>

      {/* 등록 폼 */}
      <form onSubmit={handleAdd} className="wms-card space-y-4">
        <h2 className="text-base font-semibold text-gray-300">신규 화주사 등록</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FI label="화주사명 *" placeholder="(주)OO물류"    value={form.name}    onChange={v => setForm(f => ({ ...f, name: v }))} />
          <FI label="거래처 코드" placeholder="CL-001"       value={form.code}    onChange={v => setForm(f => ({ ...f, code: v }))} />
          <FI label="담당자"     placeholder="홍길동"         value={form.contact} onChange={v => setForm(f => ({ ...f, contact: v }))} />
          <FI label="연락처"     placeholder="010-0000-0000" value={form.phone}   onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <FI label="비고"       placeholder="냉동 전용 창고" value={form.note}    onChange={v => setForm(f => ({ ...f, note: v }))} className="sm:col-span-2" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="wms-btn wms-btn-primary">
            {saving ? '등록 중...' : '+ 화주사 등록'}
          </button>
        </div>
      </form>

      {/* 목록 */}
      <div className="wms-card">
        <h2 className="text-sm font-semibold text-gray-400 mb-4">
          화주사 목록 <span className="text-gray-600">({clients.length}개)</span>
        </h2>
        {clients.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">등록된 화주사가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/[0.08]">
                <th className="pb-2.5 wms-label">화주사명</th>
                <th className="pb-2.5 wms-label">코드</th>
                <th className="pb-2.5 wms-label">담당자</th>
                <th className="pb-2.5 wms-label">연락처</th>
                <th className="pb-2.5 wms-label">비고</th>
                <th className="pb-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {clients.map(c => editingId === c.id ? (
                <tr key={c.id} className="bg-blue-950/30">
                  {['name','code','contact','phone','note'].map((k, i) => (
                    <td key={k} className="py-1.5 pr-2">
                      <input value={editForm[k]}
                        onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))}
                        className="wms-input py-1.5 text-sm w-full"
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
                  <td className="py-3 font-semibold text-white">{c.name}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs">{c.code ?? '—'}</td>
                  <td className="py-3 text-gray-300">{c.contact ?? '—'}</td>
                  <td className="py-3 text-gray-400">{c.phone ?? '—'}</td>
                  <td className="py-3 text-gray-500 text-xs">{c.note ?? '—'}</td>
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
