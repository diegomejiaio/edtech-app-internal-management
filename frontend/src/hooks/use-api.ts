import { useCallback } from 'react'
import { useAuthContext } from '@/providers/auth-provider'
import { api } from '@/lib/api'

/**
 * Hook que provee métodos de API autenticados con Clerk
 * Automatiza la obtención del token para cada request
 */
export function useApi() {
  const { getToken } = useAuthContext()

  const get = useCallback(async <T>(
    path: string, 
    params?: Record<string, string | number | undefined>
  ): Promise<T> => {
    const token = await getToken()
    return api.get<T>(path, { token, params })
  }, [getToken])

  const post = useCallback(async <T>(
    path: string, 
    data: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> => {
    const token = await getToken()
    return api.post<T>(path, data, { token, params })
  }, [getToken])

  const patch = useCallback(async <T>(
    path: string, 
    data: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> => {
    const token = await getToken()
    return api.patch<T>(path, data, { token, params })
  }, [getToken])

  const put = useCallback(async <T>(
    path: string, 
    data: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> => {
    const token = await getToken()
    return api.put<T>(path, data, { token, params })
  }, [getToken])

  const del = useCallback(async <T>(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T> => {
    const token = await getToken()
    return api.delete<T>(path, { token, params })
  }, [getToken])

  return { get, post, patch, put, delete: del }
}
