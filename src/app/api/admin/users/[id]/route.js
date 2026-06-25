import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function PATCH(req, { params }) {
  const body    = await req.json()
  const ALLOWED = ['role', 'is_active', 'is_approved', 'approved_by', 'approved_at', 'display_name', 'position']
  const update  = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))

  if (body.new_password) {
    update.password_hash = await bcrypt.hash(body.new_password, 10)
  }

  const db = getSupabaseAdmin()
  const { error } = await db.from('wms_users').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const db = getSupabaseAdmin()
  const { error } = await db.from('wms_users').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
