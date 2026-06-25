import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('wms_users')
    .select('id, username, display_name, role, position, is_active, is_approved, created_at, last_login_at, approved_at, approved_by')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
