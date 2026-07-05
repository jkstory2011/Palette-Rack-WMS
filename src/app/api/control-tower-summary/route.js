import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function startOfTodayIso() {
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  const startKst = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()))
  return new Date(startKst.getTime() - kstOffsetMs).toISOString()
}

export async function GET(request) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.CONTROL_TOWER_API_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const since = startOfTodayIso()

  const [inboundRes, outboundRes, storedRes] = await Promise.all([
    db.from('inbound_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
    db.from('outbound_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
    db.from('pallets').select('id', { count: 'exact', head: true }).eq('status', 'stored'),
  ])

  if (inboundRes.error) return NextResponse.json({ error: inboundRes.error.message }, { status: 500 })
  if (outboundRes.error) return NextResponse.json({ error: outboundRes.error.message }, { status: 500 })
  if (storedRes.error) return NextResponse.json({ error: storedRes.error.message }, { status: 500 })

  return NextResponse.json({
    todayInboundCount: inboundRes.count,
    todayOutboundCount: outboundRes.count,
    storedPalletCount: storedRes.count,
  })
}
