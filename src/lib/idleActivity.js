export const ACTIVITY_STORAGE_KEY = 'wms_last_activity'
export const WARNING_AFTER_MS = 240_000 // 4분 경과 시 경고 모달 노출
export const LOGOUT_AFTER_MS = 300_000  // 5분 경과 시 강제 로그아웃

const WRITE_THROTTLE_MS = 1000

let lastWriteAt = 0
let memoryFallbackLastActivity = null

export function recordActivity() {
  const now = Date.now()
  if (now - lastWriteAt < WRITE_THROTTLE_MS) return
  lastWriteAt = now

  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now))
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 탭 메모리로 폴백
    memoryFallbackLastActivity = now
  }
}

export function getIdleMs() {
  let last = null

  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY)
    last = raw ? Number(raw) : null
  } catch {
    last = memoryFallbackLastActivity
  }

  if (!last) {
    recordActivity()
    return 0
  }

  return Date.now() - last
}
