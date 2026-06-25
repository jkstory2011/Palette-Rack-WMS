'use client'

import { useState } from 'react'

export default function SignupPage() {
  const [form, setForm]     = useState({ username: '', displayName: '', position: '', password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username:    form.username,
        displayName: form.displayName,
        password:    form.password,
        position:    form.position || '사용자',
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) { setDone(true) }
    else { setError(data.error || '회원가입 실패') }
  }

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-5xl">✅</p>
          <h2 className="text-xl font-bold text-white">회원가입 완료!</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            가입 신청이 접수되었습니다.<br />
            관리자 승인 후 로그인할 수 있습니다.
          </p>
          <a href="/login"
            className="inline-block px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                       text-white font-semibold text-sm transition-colors">
            로그인 화면으로
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5">

        <div className="text-center mb-2">
          <p className="text-4xl mb-3">📦</p>
          <h1 className="text-xl font-black text-white">직원 회원가입</h1>
          <p className="text-gray-500 text-sm mt-1">Palette Rack WMS</p>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4 shadow-2xl">

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">아이디 *</label>
            <input type="text" value={form.username} onChange={f('username')}
              placeholder="영문·숫자·_만 사용, 3~20자" required autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">이름 *</label>
            <input type="text" value={form.displayName} onChange={f('displayName')}
              placeholder="실명 또는 닉네임" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">직급</label>
            <select value={form.position} onChange={f('position')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">선택 안 함 (사용자)</option>
              <option value="사원">사원</option>
              <option value="주임">주임</option>
              <option value="대리">대리</option>
              <option value="과장">과장</option>
              <option value="차장">차장</option>
              <option value="부장">부장</option>
              <option value="이사">이사</option>
              <option value="상무">상무</option>
              <option value="전무">전무</option>
              <option value="부사장">부사장</option>
              <option value="사장">사장</option>
              <option value="대표">대표</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">비밀번호 * <span className="text-gray-600">(6자 이상)</span></label>
            <input type="password" value={form.password} onChange={f('password')}
              placeholder="비밀번호 입력" required minLength={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">비밀번호 확인 *</label>
            <input type="password" value={form.confirm} onChange={f('confirm')}
              placeholder="비밀번호 재입력" required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-3 text-xs text-yellow-400">
            ⚠ 가입 후 관리자 승인이 필요합니다.
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                       disabled:bg-gray-700 disabled:cursor-not-allowed
                       text-white font-semibold text-sm transition-colors">
            {loading ? '처리 중...' : '회원가입 신청'}
          </button>

          <p className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium">로그인</a>
          </p>
        </form>
      </div>
    </div>
  )
}
