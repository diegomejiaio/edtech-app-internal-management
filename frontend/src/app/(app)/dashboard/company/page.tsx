'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Redirect /app/dashboard/company?ruc=... → /app/dashboard/{currentYear}/company?ruc=...
 * Keeps backward compatibility with existing links.
 */
export default function CompanyRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ruc = searchParams.get('ruc')

  const defaultYear = new Date().getFullYear() - 1

  useEffect(() => {
    router.replace(`/dashboard/${defaultYear}/company${ruc ? `?ruc=${ruc}` : ''}`)
  }, [router, ruc, defaultYear])

  return null
}
