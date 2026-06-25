'use client'

import { useState } from 'react'

const BG = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80'

export default function LoginPage() {
  const [tab, setTab]         = useState('user')
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
    <div className="min-h-screen flex">

      {/* ── 좌측: 배경 이미지 + 브랜딩 */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 relative overflow-hidden"
        style={{ backgroundImage: `url(${BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* 다크 그라디언트 오버레이 */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.70) 100%)' }} />

        {/* 콘텐츠 */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          {/* 상단 로고 */}
          <div className="flex items-center gap-4">
            <span className="text-5xl">📦</span>
            <div>
              <p className="text-white font-black text-3xl tracking-tight">Palette Rack WMS</p>
              <p className="text-gray-400 text-sm mt-0.5">파렛트랙 입출고 관리 시스템</p>
            </div>
          </div>

          {/* 중앙 카피 */}
          <div className="space-y-4">
            <h2 className="text-white text-4xl font-black leading-tight">
              스마트한<br />
              물류창고 관리
            </h2>
            <p className="text-gray-300 text-base leading-relaxed max-w-sm">
              FIFO 기반 입출고, 실시간 재고 파악,<br />
              멀티 파렛트랙 로케이션을 한 곳에서.
            </p>
            <div className="flex gap-6 pt-2">
              {[['📥', '입고관리'], ['🚛', '출고관리'], ['📍', '로케이션'], ['📊', '이력조회']].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 하단 저작권 */}
          <p className="text-gray-600 text-xs">© 2026 Palette Rack WMS</p>
        </div>
      </div>

      {/* ── 우측: 로그인 패널 */}
      <div
        className="flex flex-col justify-center items-center w-full lg:w-[420px] xl:w-[480px] shrink-0 relative px-8 py-12"
        style={{
          background: 'linear-gradient(180deg, #0b0f1a 0%, #0f1623 100%)',
        }}
      >
        {/* 모바일 배경 */}
        <div className="absolute inset-0 lg:hidden"
          style={{ backgroundImage: `url(${BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 lg:hidden bg-gray-950/85 backdrop-blur-sm" />

        <div className="relative z-10 w-full max-w-sm space-y-6">

          {/* 모바일용 로고 */}
          <div className="lg:hidden text-center mb-2">
            <p className="text-4xl mb-2">📦</p>
            <h1 className="text-xl font-black text-white">Palette Rack WMS</h1>
            <p className="text-gray-500 text-sm">창고 관리 시스템</p>
          </div>

          {/* 데스크톱 제목 */}
          <div className="hidden lg:block">
            <h2 className="text-2xl font-black text-white">로그인</h2>
            <p className="text-gray-500 text-sm mt-1">계정 정보를 입력해주세요</p>
          </div>

          {/* 탭 */}
          <div className="flex bg-gray-800/60 border border-gray-700/60 rounded-xl p-1 backdrop-blur-sm">
            <button onClick={() => { setTab('user'); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === 'user' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
              }`}>
              직원 로그인
            </button>
            <button onClick={() => { setTab('dev'); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === 'dev' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
              }`}>
              🔧 개발관리자
            </button>
          </div>

          {/* 직원 로그인 */}
          {tab === 'user' && (
            <form onSubmit={handleUserLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">아이디</label>
                <input type="text" value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="아이디를 입력하세요" autoFocus required
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 text-sm backdrop-blur-sm
                             focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">비밀번호</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="비밀번호를 입력하세요" required
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 text-sm backdrop-blur-sm
                             focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-800/40 rounded-xl py-2 px-3">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || !form.username || !form.password}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                           disabled:bg-gray-700 disabled:cursor-not-allowed
                           text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-900/30">
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
            <form onSubmit={handleDevLogin} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔧</span>
                <h2 className="text-white font-bold">개발관리자 로그인</h2>
              </div>
              <p className="text-xs text-gray-600">시스템 관리자 전용 접근입니다.</p>

              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">관리자 비밀번호</label>
                <input type="password" value={devPw}
                  onChange={e => setDevPw(e.target.value)}
                  placeholder="관리자 비밀번호" autoFocus required
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3
                             text-white placeholder-gray-600 text-sm
                             focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-800/40 rounded-xl py-2 px-3">
                  {error}
                </p>
              )}

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
    </div>
  )
}
