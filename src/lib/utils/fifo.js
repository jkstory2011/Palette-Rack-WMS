/**
 * FIFO 출고 유틸
 *
 * v_stock 뷰 또는 pallets+pallet_items 조인 결과에서
 * 특정 상품의 출고 순서(inbound_at ASC)를 계산해 로케이션 안내 목록을 반환
 */

/**
 * 상품 ID 기준으로 FIFO 정렬된 재고 로케이션 목록 반환
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} productId
 * @returns {Promise<FifoItem[]>}
 *
 * @typedef {Object} FifoItem
 * @property {number}  rank          - FIFO 순위 (1 = 먼저 출고)
 * @property {number}  palletId
 * @property {string}  palletCode
 * @property {number}  locationId
 * @property {string}  locationCode  - 'A-01'
 * @property {number}  tier          - 1~4
 * @property {string}  side          - 'L' | 'R'
 * @property {string}  zoneCode
 * @property {number}  grid_x
 * @property {number}  grid_y
 * @property {string}  inboundAt     - ISO 문자열
 * @property {number}  qty           - 해당 상품 수량
 * @property {boolean} isMixed       - 혼적 여부
 */
export async function getFifoLocations(supabase, productId) {
  // v_stock 뷰: fifo_rank 는 product_id 파티션 내 inbound_at ASC 기준 ROW_NUMBER
  const { data, error } = await supabase
    .from('v_stock')
    .select('*')
    .eq('product_id', productId)
    .order('fifo_rank', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return []

  // 같은 파렛트에 이 상품 말고 다른 상품도 있으면 → 혼적
  const palletItemCounts = await getPalletItemCounts(supabase, data.map((r) => r.pallet_id))

  return data.map((row, i) => ({
    rank:         i + 1,
    palletId:     row.pallet_id,
    palletCode:   row.pallet_code,
    locationId:   row.location_id,
    locationCode: row.location_code,
    tier:         row.tier,
    side:         row.side,
    zoneCode:     row.zone_code,
    grid_x:       row.grid_x,
    grid_y:       row.grid_y,
    inboundAt:    row.inbound_at,
    qty:          row.qty,
    isMixed:      (palletItemCounts[row.pallet_id] ?? 1) > 1,
  }))
}

/** 파렛트 ID 배열 → { palletId: itemCount } 맵 반환 */
async function getPalletItemCounts(supabase, palletIds) {
  if (palletIds.length === 0) return {}

  const { data } = await supabase
    .from('pallet_items')
    .select('pallet_id')
    .in('pallet_id', palletIds)

  const counts = {}
  for (const row of data ?? []) {
    counts[row.pallet_id] = (counts[row.pallet_id] ?? 0) + 1
  }
  return counts
}

/**
 * 요청 수량에 대해 필요한 파렛트 목록을 FIFO 순으로 반환
 * (각 파렛트의 해당 상품 수량을 합산해 요청 수량을 충족하는 최소 목록)
 *
 * @param {FifoItem[]} fifoList - getFifoLocations() 결과
 * @param {number}     needed   - 출고 요청 수량
 * @returns {{ items: FifoItem[], totalQty: number, fulfilled: boolean }}
 */
export function pickFifoItems(fifoList, needed) {
  let remaining = needed
  const picked = []

  for (const item of fifoList) {
    if (remaining <= 0) break
    picked.push(item)
    remaining -= item.qty
  }

  return {
    items:     picked,
    totalQty:  fifoList.slice(0, picked.length).reduce((s, i) => s + i.qty, 0),
    fulfilled: remaining <= 0,
  }
}
