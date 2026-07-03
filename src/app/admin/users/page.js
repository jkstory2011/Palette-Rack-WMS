'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { POSITIONS as BASE_POSITIONS } from '@/lib/positions'

const POSITIONS = ['사용자', ...BASE_POSITIONS]

function PositionSelect({ user, onSave }) {
  return (
    <select
      value={user.position || '사용자'}
      onChange={e => onSave(e.target.value)}
      className="wms-select py-1 px-2 text-xs rounded-lg min-w-[70px]"
    >
      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  )
}

export default function UsersPage() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('pending')
  const [resetPw, setResetPw] = useState({})
  const [busy, setBusy]       = useState({})
  const [toast, setToast]     = useState(null)
  const [search, setSearch]   = useState('')

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      showToast('목록을 불러오지 못했습니다.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  async function patch(id, body) {
    const res  = await fetch(`/api/admin/users/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `오류 (${res.status})`)
    await fetchUsers()
  }

  async function approve(user) {
    setBusy(b => ({ ...b, [user.id]: true }))
    try {
      await patch(user.id, {
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: '관리자',
      })
      showToast(`${user.display_name} 계정을 승인했습니다.`)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [user.id]: false }))
    }
  }

  async function deleteUser(user) {
    if (!confirm(`${user.display_name}(${user.username}) 계정을 삭제할까요?`)) return
    setBusy(b => ({ ...b, [user.id]: true }))
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      showToast(`${user.display_name} 계정을 삭제했습니다.`)
      await fetchUsers()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [user.id]: false }))
    }
  }

  async function toggleActive(user) {
    setBusy(b => ({ ...b, [user.id]: true }))
    try {
      await patch(user.id, { is_active: !user.is_active })
      showToast(`${user.display_name} 계정을 ${!user.is_active ? '활성화' : '비활성화'}했습니다.`)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [user.id]: false }))
    }
  }

  async function changePosition(user, position) {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, position } : u))
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`)
      showToast(`${user.display_name} 직급을 ${position}으로 변경했습니다.`)
    } catch (e) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, position: user.position } : u))
      showToast(e.message, 'error')
    }
  }

  async function changeRole(user, role) {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u))
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`)
      showToast(`${user.display_name} 권한을 ${role === 'admin' ? '관리자' : '직원'}으로 변경했습니다.`)
    } catch (e) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: user.role } : u))
      showToast(e.message, 'error')
    }
  }

  async function handleResetPw(user) {
    const pw = resetPw[user.id]?.trim()
    if (!pw || pw.length < 6) { showToast('6자 이상 입력하세요.', 'error'); return }
    if (!confirm(`${user.display_name}의 비밀번호를 재설정할까요?`)) return
    setBusy(b => ({ ...b, [user.id + '_pw']: true }))
    try {
      await patch(user.id, { new_password: pw })
      setResetPw(p => ({ ...p, [user.id]: '' }))
      showToast('비밀번호를 재설정했습니다.')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setBusy(b => ({ ...b, [user.id + '_pw']: false }))
    }
  }

  const pending  = users.filter(u => !u.is_approved)
  const approved = users.filter(u => u.is_approved)

  const filtered = (tab === 'pending' ? pending : approved).filter(u => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.position?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
          ${toast.type === 'error' ? 'wms-alert-error' : 'wms-alert-success'}`}
          style={{ zIndex: 9999 }}>
          {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/admin"
          className="text-slate-500 hover:text-slate-300 transition-colors text-sm flex items-center gap-1">
          ← 관리 홈
        </Link>
        <span className="text-slate-700">/</span>
        <h1 className="text-2xl font-black text-white tracking-tight">👥 회원 관리</h1>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-yellow-400">{pending.length}</p>
          <p className="text-xs text-slate-400 mt-1">승인 대기</p>
        </div>
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-emerald-400">{approved.filter(u => u.is_active).length}</p>
          <p className="text-xs text-slate-400 mt-1">활성 계정</p>
        </div>
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-slate-500">{approved.filter(u => !u.is_active).length}</p>
          <p className="text-xs text-slate-400 mt-1">비활성 계정</p>
        </div>
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-indigo-400">{approved.filter(u => u.role === 'admin').length}</p>
          <p className="text-xs text-slate-400 mt-1">관리자</p>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 border-b border-white/10 flex-1">
          {[
            { key: 'pending', label: `⏳ 승인 대기`, count: pending.length },
            { key: 'all',     label: `👤 전체 직원`, count: approved.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => { setTab(key); setSearch('') }}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-colors relative ${
                tab === key
                  ? 'bg-white/[0.06] text-white border border-b-0 border-white/15'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {label}
              {count > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                  key === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-[#F59E0B]/12 text-[#F59E0B]'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'all' && (
          <input
            type="text"
            placeholder="이름·아이디·직급 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="wms-input py-2 text-sm w-48 shrink-0"
          />
        )}
      </div>

      {/* ── 승인 대기 탭 ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <div className="wms-card text-center py-12 text-gray-600">
              <p className="text-3xl mb-3">🎉</p>
              <p>승인 대기 중인 계정이 없습니다.</p>
            </div>
          ) : filtered.map(u => (
            <div key={u.id} className="wms-card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold text-base">{u.display_name}</span>
                  {u.position && u.position !== '사용자' && (
                    <span className="wms-tag">{u.position}</span>
                  )}
                  <span className="text-gray-500 text-sm font-mono">@{u.username}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  가입: {new Date(u.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => approve(u)} disabled={busy[u.id]}
                  className="wms-btn wms-btn-success">
                  {busy[u.id] ? '처리 중...' : '✅ 승인'}
                </button>
                <button onClick={() => deleteUser(u)} disabled={busy[u.id]}
                  className="wms-btn wms-btn-danger">
                  🗑 거부
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 전체 직원 탭 ── */}
      {tab === 'all' && (
        <div className="wms-card overflow-x-auto p-0">
          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              {search ? '검색 결과가 없습니다.' : '승인된 계정이 없습니다.'}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['이름', '직급', '아이디', '권한', '상태', '마지막 로그인', '비밀번호 재설정', ''].map(h => (
                    <th key={h} className="px-5 pb-3 pt-4 text-left text-xs font-semibold tracking-[0.1em] uppercase font-mono text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-5 py-3">
                      <div>
                        <span className="text-white font-semibold">{u.display_name}</span>
                        {!u.is_active && (
                          <span className="ml-2 text-[10px] text-slate-600 font-mono">(비활성)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <PositionSelect user={u} onSave={pos => changePosition(u, pos)} />
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-400 text-xs">@{u.username}</td>
                    <td className="px-5 py-3">
                      <select value={u.role} onChange={e => changeRole(u, e.target.value)}
                        className="wms-select py-1 px-2 text-xs rounded-lg">
                        <option value="staff">직원</option>
                        <option value="admin">관리자</option>
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(u)}
                        className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                          u.is_active
                            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/60 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/60'
                            : 'text-slate-500 border border-white/10 hover:bg-emerald-900/30 hover:text-emerald-400 hover:border-emerald-800/60'
                        }`}
                        style={{ background: u.is_active ? undefined : 'rgba(255,255,255,0.04)' }}>
                        {u.is_active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <input type="password" placeholder="새 비밀번호 (6자+)"
                          value={resetPw[u.id] ?? ''}
                          onChange={e => setResetPw(p => ({ ...p, [u.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleResetPw(u)}
                          className="wms-input py-1 px-2 text-xs rounded-lg w-32" />
                        <button onClick={() => handleResetPw(u)} disabled={busy[u.id + '_pw']}
                          className="wms-btn wms-btn-ghost text-xs py-1 px-2">
                          {busy[u.id + '_pw'] ? '...' : '변경'}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => deleteUser(u)}
                        className="text-xs text-slate-600 hover:text-red-400 transition-colors px-2 py-1 rounded">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
