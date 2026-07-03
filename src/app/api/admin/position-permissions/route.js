import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId가 필요합니다.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('wms_position_admin_grants')
    .select('position')
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(r => r.position))
}

export async function PATCH(req) {
  const { companyId, position, isAdmin } = await req.json()

  if (!companyId || !position) {
    return NextResponse.json({ error: 'companyId와 position이 필요합니다.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  if (isAdmin) {
    const { error } = await db
      .from('wms_position_admin_grants')
      .upsert({ company_id: companyId, position })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await db
      .from('wms_position_admin_grants')
      .delete()
      .eq('company_id', companyId)
      .eq('position', position)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
