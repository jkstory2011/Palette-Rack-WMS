'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [pw, setPw]         = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })

    if (res.ok) {
      // 쿠키 설정 후 풀 페이지 리로드 — 미들웨어가 쿠키를 확실히 인식하게 함
      window.location.href = '/'
    } else {
      const data = await res.json()
      setError(data.error || '비밀번호가 틀렸습니다.')
      setPw('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <p className="text-4xl mb-3">🏭</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Palette Rack WMS</h1>
          <p className="text-gray-500 text-sm mt-1">창고 관리 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5 shadow-2xl"
        >
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoFocus
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                         text-white placeholder-gray-600 text-sm
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !pw}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                       disabled:bg-gray-700 disabled:cursor-not-allowed
                       text-white font-semibold text-sm transition-colors"
          >
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>

      </div>
    </div>
  )
}
