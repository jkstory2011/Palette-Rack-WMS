import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const db = getSupabaseAdmin()

  // 버킷 생성 (이미 있으면 무시)
  const { error } = await db.storage.createBucket('client-docs', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  })

  // 이미 존재하는 경우는 성공으로 처리
  if (error && !error.message.includes('already exists')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
