'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const CompanyCtx = createContext(null)

/**
 * company: { id, code, name } | null (superadmin은 null 가능)
 * isSuperAdmin: boolean
 * companies: [{ id, code, name }] (superadmin만 목록 제공)
 */
export function CompanyProvider({ company, isSuperAdmin, companies = [], children }) {
  const [active, setActive] = useState(company)

  const switchCompany = useCallback(async (comp) => {
    await fetch('/api/auth/switch-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: comp?.id ?? null }),
    })
    setActive(comp)
    window.location.reload()
  }, [])

  return (
    <CompanyCtx.Provider value={{ company: active, isSuperAdmin, companies, switchCompany }}>
      {children}
    </CompanyCtx.Provider>
  )
}

export function useCompany() {
  return useContext(CompanyCtx)
}
