import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getCallerAccess() {
  const jar = cookies()
  const devAdmin = jar.get('wms_auth')?.value === '1'
  if (devAdmin) return { allowed: 'any' }

  const userToken = jar.get('wms_user')?.value
  const user = userToken ? await verifyToken(userToken) : null
  if (!user) return { allowed: 'none' }
  if (user.role === 'superadmin') return { allowed: 'any' }
  return { allowed: 'own', companyId: user.companyId }
}

function isCompanyAllowed(access, companyId) {
  if (access.allowed === 'any') return true
  if (access.allowed === 'own') return String(access.companyId) === String(companyId)
  return false
}

export async function GET(req) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) {
    return NextResponse.json({ error: 'companyId가 필요합니다.' }, { status: 400 })
  }

  const access = await getCallerAccess()
  if (!isCompanyAllowed(access, companyId)) {
    return NextResponse.json({ error: '다른 회사의 설정은 조회할 수 없습니다.' }, { status: 403 })
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

  const access = await getCallerAccess()
  if (!isCompanyAllowed(access, companyId)) {
    return NextResponse.json({ error: '다른 회사의 설정은 변경할 수 없습니다.' }, { status: 403 })
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
