/**
 * 파렛트 코드 자동 생성
 * 형식: PLT-YYYYMMDD-NNN  (날짜 + 3자리 시퀀스)
 * 같은 날짜에 여러 개 생성 시 순번이 자동으로 증가
 */
export function generatePalletCode(existingCodes = []) {
  const today = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')            // '20240624'

  const prefix = `PLT-${today}-`

  // 오늘 날짜 접두어를 가진 코드들의 최대 순번을 찾음
  const todayNums = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))

  const next = todayNums.length > 0 ? Math.max(...todayNums) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

/** 파렛트 코드 유효성 검사 (PLT-YYYYMMDD-NNN) */
export function isValidPalletCode(code) {
  return /^PLT-\d{8}-\d{3,}$/.test(code)
}

/** 단(tier) + 측(side) → 슬롯 식별 레이블 */
export function slotLabel(tier, side) {
  return `${tier}단-${side === 'L' ? '좌' : '우'}`
}
