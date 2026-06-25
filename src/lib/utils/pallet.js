/**
 * 파렛트 코드 자동 생성 (단일)
 * 형식: PLT-YYYYMMDD-NNN
 */
export function generatePalletCode(existingCodes = []) {
  return generatePalletCodes(existingCodes, 1)[0]
}

/**
 * 파렛트 코드 배치 생성 (N개)
 */
export function generatePalletCodes(existingCodes = [], count = 1) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `PLT-${today}-`

  const todayNums = existingCodes
    .filter((c) => c.startsWith(prefix))
    .map((c) => parseInt(c.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))

  let next = todayNums.length > 0 ? Math.max(...todayNums) + 1 : 1
  return Array.from({ length: count }, () => `${prefix}${String(next++).padStart(3, '0')}`)
}

/** 오더 번호 생성 (IN-YYYYMMDD-NNN) */
export function generateOrderNo(existingNos = [], prefix = 'IN') {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const p = `${prefix}-${today}-`
  const nums = existingNos
    .filter((n) => n.startsWith(p))
    .map((n) => parseInt(n.slice(p.length), 10))
    .filter((n) => !isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${p}${String(next).padStart(3, '0')}`
}

/** 파렛트 코드 유효성 검사 (PLT-YYYYMMDD-NNN) */
export function isValidPalletCode(code) {
  return /^PLT-\d{8}-\d{3,}$/.test(code)
}

/** 단(tier) + 측(side) → 슬롯 식별 레이블 */
export function slotLabel(tier, side) {
  return `${tier}단-${side === 'L' ? '좌' : '우'}`
}
