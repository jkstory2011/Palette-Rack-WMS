'use client'

import { useEffect, useRef, useState } from 'react'
import { recordActivity, getIdleMs, WARNING_AFTER_MS, LOGOUT_AFTER_MS } from '@/lib/idleActivity'
import { performLogout } from '@/lib/logout'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
const POLL_INTERVAL_MS = 1000

export default function IdleTimeoutWatcher() {
  const [secondsLeft, setSecondsLeft] = useState(null) // null = 경고 모달 숨김
  const loggedOutRef = useRef(false)

  useEffect(() => {
    recordActivity() // 마운트 시 활동 시각 초기화

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, recordActivity))

    function check() {
      if (loggedOutRef.current) return
      const idleMs = getIdleMs()

      if (idleMs >= LOGOUT_AFTER_MS) {
        loggedOutRef.current = true
        performLogout()
        return
      }

      if (idleMs >= WARNING_AFTER_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((LOGOUT_AFTER_MS - idleMs) / 1000)))
      } else {
        setSecondsLeft(null)
      }
    }

    const intervalId = setInterval(check, POLL_INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, recordActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(intervalId)
    }
  }, [])

  function handleContinue() {
    recordActivity()
    setSecondsLeft(null)
  }

  if (secondsLeft === null) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="rounded-xl p-6 max-w-sm w-full text-center"
          style={{ background: '#151822', border: '1px solid #2A2F3A' }}
        >
          <p className="text-white font-semibold text-lg mb-2">
            자동 로그아웃 안내
          </p>
          <p className="text-gray-400 text-sm mb-5">
            5분간 활동이 없어 <span className="text-amber-400 font-semibold">{secondsLeft}초</span> 후 자동 로그아웃됩니다.
          </p>
          <button
            onClick={handleContinue}
            className="w-full px-5 py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            계속 사용하기
          </button>
        </div>
      </div>
    </>
  )
}
