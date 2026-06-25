'use client'

import { useEffect, useState } from 'react'

const ROLE_META = {
  staff: { label: '직원',   cls: 'text-gray-400 bg-gray-700'   },
  admin: { label: '관리자', cls: 'text-blue-300 bg-blue-900/40' },
}

export default function AdminPage() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('pending')
  const [resetPw, setResetPw]   = useState({})
  const [busy, setBusy]         = useState({})    // { [id]: true } 버튼 로딩
  const [toast, setToast]       = useState(null)  // { msg, type }

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

  async function reject(user) {
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
      const res  = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ position }),
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
    // 낙관적 업데이트: 먼저 UI 즉시 반영
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u))
    try {
      const res  = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `오류 (${res.status})`)
      showToast(`${user.display_name} 권한을 ${role === 'admin' ? '관리자' : '직원'}으로 변경했습니다.`)
    } catch (e) {
      // 실패 시 원래 값으로 롤백
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
  const list     = tab === 'pending' ? pending : approved

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">⚙ 관리 페이지</h1>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold
          transition-all ${toast.type === 'error'
            ? 'bg-red-900 border border-red-700 text-red-200'
            : 'bg-green-900 border border-green-700 text-green-200'}`}>
          {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
        </div>
      )}

      {/* 현황 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-yellow-400">{pending.length}</p>
          <p className="text-xs text-gray-500 mt-1">승인 대기</p>
        </div>
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-green-400">{approved.filter(u => u.is_active).length}</p>
          <p className="text-xs text-gray-500 mt-1">활성 계정</p>
        </div>
        <div className="wms-card text-center py-4">
          <p className="text-2xl font-black text-gray-500">{approved.filter(u => !u.is_active).length}</p>
          <p className="text-xs text-gray-500 mt-1">비활성 계정</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-gray-700">
        {[
          { key: 'pending', label: `⏳ 승인 대기 (${pending.length})` },
          { key: 'all',     label: `👥 전체 직원 (${approved.length})` },
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

      {/* 승인 대기 */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : list.length === 0 ? (
            <div className="wms-card text-center py-10 text-gray-600">승인 대기 중인 계정이 없습니다.</div>
          ) : list.map(u => (
            <div key={u.id} className="wms-card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{u.display_name}</span>
                  {u.position && u.position !== '사용자' && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{u.position}</span>
                  )}
                  <span className="text-gray-500 text-sm font-mono">@{u.username}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  가입: {new Date(u.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => approve(u)} disabled={busy[u.id]}
                  className="px-4 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy[u.id] ? '처리 중...' : '✅ 승인'}
                </button>
                <button onClick={() => reject(u)} disabled={busy[u.id]}
                  className="px-4 py-2 rounded-xl bg-red-800 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  🗑 거부
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 전체 직원 */}
      {tab === 'all' && (
        <div className="wms-card overflow-x-auto">
          {loading ? (
            <p className="text-center text-gray-500 py-8 animate-pulse">불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="text-center text-gray-600 py-8">승인된 계정이 없습니다.</p>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                  <th className="pb-2 pr-4 font-medium">이름</th>
                  <th className="pb-2 pr-4 font-medium">직급</th>
                  <th className="pb-2 pr-4 font-medium">아이디</th>
                  <th className="pb-2 pr-4 font-medium">권한</th>
                  <th className="pb-2 pr-4 font-medium">상태</th>
                  <th className="pb-2 pr-4 font-medium">마지막 로그인</th>
                  <th className="pb-2 pr-4 font-medium">비밀번호 재설정</th>
                  <th className="pb-2 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {list.map(u => {
                  const rm = ROLE_META[u.role] ?? ROLE_META.staff
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 pr-4 text-white font-medium">{u.display_name}</td>
                      <td className="py-3 pr-4">
                        <PositionSelect user={u} onSave={(pos) => changePosition(u, pos)} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-gray-400 text-xs">@{u.username}</td>
                      <td className="py-3 pr-4">
                        <select value={u.role} onChange={e => changeRole(u, e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300
                                     focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="staff">직원</option>
                          <option value="admin">관리자</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <button onClick={() => toggleActive(u)}
                          className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                            u.is_active
                              ? 'bg-green-900/40 text-green-400 border border-green-800 hover:bg-red-900/40 hover:text-red-400 hover:border-red-800'
                              : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-green-900/40 hover:text-green-400 hover:border-green-800'
                          }`}>
                          {u.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-500">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ko-KR') : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1">
                          <input type="password" placeholder="새 비밀번호"
                            value={resetPw[u.id] ?? ''}
                            onChange={e => setResetPw(p => ({ ...p, [u.id]: e.target.value }))}
                            className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white
                                       focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <button onClick={() => handleResetPw(u)}
                            className="text-xs px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors">
                            변경
                          </button>
                        </div>
                      </td>
                      <td className="py-3">
                        <button onClick={() => reject(u)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const POSITIONS = ['사용자', '사원', '주임', '대리', '팀장', '과장', '차장', '부장', '실장', '대표']

function PositionSelect({ user, onSave }) {
  return (
    <select
      value={user.position || '사용자'}
      onChange={e => onSave(e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300
                 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[70px]"
    >
      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  )
}
