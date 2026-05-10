'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect /app/dashboard → /app/dashboard/{previousYear}
 * Loads previous year by default (accountants typically work on the prior fiscal year).
 */
export default function DashboardRedirect() {
  const router = useRouter()
  const defaultYear = new Date().getFullYear() - 1

  useEffect(() => {
    router.replace(`/dashboard/${defaultYear}`)
  }, [router, defaultYear])

  return null
}
