import { env, DEV_MODE, DEV_DEFAULTS } from './env'

const API_URL = env.apiUrl
const API_VERSION = env.apiVersion

interface RequestOptions {
  params?: Record<string, string | number | undefined>
  token?: string | null
  /**
   * Override tenant ID for dev mode testing.
   * Only used when DEV_MODE=true.
   */
  devTenantId?: string
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  // Si path ya tiene /v1, no agregar apiVersion
  const fullPath = path.startsWith('/v1') ? path : `${API_VERSION}${path}`
  
  // Construir URL - API_URL ya es una URL completa
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL
  const url = new URL(`${baseUrl}${fullPath}`)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.append(key, String(value))
      }
    })
  }
  return url.toString()
}

/**
 * Get selected tenant ID from localStorage (for Master role tenant switching)
 */
function getSelectedTenantId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('selectedTenantId')
}

/**
 * Build request headers with auth support
 * 
 * In DEV_MODE:
 *   - Adds X-Dev-Tenant header with tenant ID
 *   - Token is ignored
 * 
 * In production:
 *   - Adds Authorization Bearer token
 *   - Adds X-Tenant-Context header if Master user has selected a different tenant
 */
function buildHeaders(options?: { token?: string | null; devTenantId?: string }): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Get selected tenant from localStorage (for Master role switching)
  const selectedTenantId = getSelectedTenantId()

  if (DEV_MODE) {
    // Dev mode - use X-Dev-Tenant header instead of auth token
    const tenantId = options?.devTenantId || selectedTenantId || DEV_DEFAULTS.tenantId
    headers['X-Dev-Tenant'] = tenantId
    
    // Also add X-Tenant-Context for Master role switching in dev
    if (selectedTenantId) {
      headers['X-Tenant-Context'] = selectedTenantId
    }
  } else if (options?.token) {
    // Production mode - use Bearer token
    headers['Authorization'] = `Bearer ${options.token}`
    
    // Add X-Tenant-Context for Master role switching
    if (selectedTenantId) {
      headers['X-Tenant-Context'] = selectedTenantId
    }
  } else {
    // Debug: log when token is missing in production
    console.warn('[API] No token provided for request in production mode')
  }

  return headers
}

/**
 * Translate network errors to user-friendly messages
 */
function handleNetworkError(error: unknown): never {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    throw new Error('Servicio no disponible')
  }
  if (error instanceof Error) {
    throw error
  }
  throw new Error('Error desconocido')
}

/**
 * Extract error message from various API response formats
 */
function extractErrorMessage(error: Record<string, unknown>): string {
  // FastAPI default: { detail: "string" }
  if (typeof error.detail === 'string') {
    return error.detail
  }
  
  // RFC 7807 / APIError: { detail: { detail: "mensaje", ... } }
  const detail = error.detail as Record<string, unknown> | undefined
  if (detail?.detail && typeof detail.detail === 'string') {
    return detail.detail
  }
  
  // Legacy: { error: { message: "..." } }
  const errorObj = error.error as Record<string, unknown> | undefined
  if (errorObj?.message && typeof errorObj.message === 'string') {
    return errorObj.message
  }
  
  // Simple: { message: "..." }
  if (typeof error.message === 'string') {
    return error.message
  }
  
  return 'Error en la solicitud'
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(extractErrorMessage(error))
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    return null as T
  }
  
  return response.json()
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Core request function - all HTTP methods use this
 */
async function request<T>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions,
  data?: unknown
): Promise<T> {
  const url = buildUrl(path, options?.params)
  
  const init: RequestInit = {
    method,
    headers: buildHeaders(options),
  }
  
  if (data !== undefined) {
    init.body = JSON.stringify(data)
  }
  
  try {
    const res = await fetch(url, init)
    return handleResponse<T>(res)
  } catch (error) {
    handleNetworkError(error)
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => 
    request<T>('GET', path, options),

  post: <T>(path: string, data: unknown, options?: RequestOptions) => 
    request<T>('POST', path, options, data),

  patch: <T>(path: string, data: unknown, options?: RequestOptions) => 
    request<T>('PATCH', path, options, data),

  put: <T>(path: string, data: unknown, options?: RequestOptions) => 
    request<T>('PUT', path, options, data),

  delete: <T>(path: string, options?: RequestOptions) => 
    request<T>('DELETE', path, options),
}
