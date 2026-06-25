'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [tab, setTab]         = useState('user')   // 'user' | 'dev'
  const [form, setForm]       = useState({ username: '', password: '' })
  const [devPw, setDevPw]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUserLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/auth/user-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username, password: form.password }),
    })
    if (res.ok) { window.location.href = '/' }
    else {
      const d = await res.json()
      setError(d.error || '로그인 실패')
      setForm(f => ({ ...f, password: '' }))
    }
    setLoading(false)
  }

  async function handleDevLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: devPw }),
    })
    if (res.ok) { window.location.href = '/' }
    else {
      const d = await res.json()
      setError(d.error || '비밀번호가 틀렸습니다.')
      setDevPw('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5">

        {/* 로고 */}
        <div className="text-center mb-6">
          <p className="text-4xl mb-3">📦</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Palette Rack WMS</h1>
          <p className="text-gray-500 text-sm mt-1">창고 관리 시스템</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button onClick={() => { setTab('user'); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'user' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            직원 로그인
          </button>
          <button onClick={() => { setTab('dev'); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'dev' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            🔧 개발관리자
          </button>
        </div>

        {/* 직원 로그인 */}
        {tab === 'user' && (
          <form onSubmit={handleUserLogin}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4 shadow-2xl">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">아이디</label>
              <input type="text" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="아이디를 입력하세요" autoFocus required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">비밀번호</label>
              <input type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="비밀번호를 입력하세요" required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button type="submit" disabled={loading || !form.username || !form.password}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                         disabled:bg-gray-700 disabled:cursor-not-allowed
                         text-white font-semibold text-sm transition-colors">
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <p className="text-center text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <a href="/signup" className="text-blue-400 hover:text-blue-300 font-medium">회원가입</a>
            </p>
          </form>
        )}

        {/* 개발관리자 로그인 */}
        {tab === 'dev' && (
          <form onSubmit={handleDevLogin}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🔧</span>
              <h2 className="text-white font-bold">개발관리자 로그인</h2>
            </div>
            <p className="text-xs text-gray-600">시스템 관리자 전용 접근입니다.</p>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">관리자 비밀번호</label>
              <input type="password" value={devPw}
                onChange={e => setDevPw(e.target.value)}
                placeholder="관리자 비밀번호" autoFocus required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                           text-white placeholder-gray-600 text-sm
                           focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button type="submit" disabled={loading || !devPw}
              className="w-full py-3 rounded-xl bg-orange-700 hover:bg-orange-600
                         disabled:bg-gray-700 disabled:cursor-not-allowed
                         text-white font-semibold text-sm transition-colors">
              {loading ? '확인 중...' : '관리자 입장'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
