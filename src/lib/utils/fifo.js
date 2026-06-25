/**
 * FIFO 출고 유틸
 */

export async function getFifoLocations(supabase, productId) {
  const { data, error } = await supabase
    .from('v_stock')
    .select('*')
    .eq('product_id', productId)
    .order('fifo_rank', { ascending: true })

  if (error) throw error
  if (!data || data.length === 0) return []

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
 * 요청 수량에 대해 FIFO 순으로 각 파렛트에서 얼마씩 꺼낼지 계산
 * - shipQty: 이 파렛트에서 실제 출고할 수량
 * - isPartial: true면 파렛트 전량이 아닌 일부만 출고
 */
export function pickFifoItems(fifoList, needed) {
  let remaining = needed
  const items = []

  for (const item of fifoList) {
    if (remaining <= 0) break
    const shipQty = Math.min(item.qty, remaining)
    items.push({ ...item, shipQty, isPartial: shipQty < item.qty })
    remaining -= shipQty
  }

  return {
    items,
    totalQty:  items.reduce((s, i) => s + i.shipQty, 0),
    fulfilled: remaining <= 0,
  }
}
