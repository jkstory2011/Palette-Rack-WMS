import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  const formData = await req.formData()
  const file = formData.get('file')
  const path = formData.get('path')

  if (!file || !path) {
    return NextResponse.json({ error: '파일 또는 경로가 없습니다.' }, { status: 400 })
  }

  const db = getSupabaseAdmin()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await db.storage
    .from('client-docs')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = db.storage.from('client-docs').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
