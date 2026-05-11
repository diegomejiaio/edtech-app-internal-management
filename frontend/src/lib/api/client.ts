import type { ProblemDetails } from './types';
import { ApiError } from './errors';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

const API_URL =
  (typeof process !== 'undefined' &&
    (process.env as Record<string, string | undefined>)[
      'NEXT_PUBLIC_API_URL'
    ]) ||
  'http://localhost:7071';

const API_VERSION =
  (typeof process !== 'undefined' &&
    (process.env as Record<string, string | undefined>)[
      'NEXT_PUBLIC_API_VERSION'
    ]) ||
  'v1';

const BASE_URL = `${API_URL}/api/${API_VERSION}`;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RequestOptions {
  /** Query-string parameters. `undefined` values are omitted. */
  params?: Record<string, string | number | boolean | undefined>;
  /** Additional request headers. */
  headers?: Record<string, string>;
  /** Value for the `If-Match` header (ETag concurrency control). */
  ifMatch?: string;
  /** Caller-supplied abort signal (merged with the timeout signal). */
  signal?: AbortSignal;
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

export interface CreateApiClientOptions {
  /** Returns the Clerk JWT (or `null` for unauthenticated requests). */
  getToken: () => Promise<string | null>;
  /** Override the resolved base URL (e.g. for tests). */
  baseUrl?: string;
  /** Default timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryString(
  params: Record<string, string | number | boolean | undefined> | undefined,
): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined,
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}

function mergeSignals(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onCallerAbort = () => controller.abort();
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  };

  return { signal: controller.signal, cleanup };
}

async function handleResponse<T>(response: Response, url: string): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    let problem: ProblemDetails;

    if (contentType.startsWith('application/problem+json')) {
      problem = (await response.json()) as ProblemDetails;
    } else {
      problem = {
        type: 'about:blank',
        title: response.statusText || 'Unknown Error',
        status: response.status,
      };
    }

    throw new ApiError(problem, response.status, url);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApiClient(opts: CreateApiClientOptions): ApiClient {
  const base = opts.baseUrl ?? BASE_URL;
  const defaultTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${base}${path}${buildQueryString(options.params)}`;
    const timeout = options.timeoutMs ?? defaultTimeout;
    const { signal, cleanup } = mergeSignals(timeout, options.signal);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.ifMatch) {
      headers['If-Match'] = options.ifMatch;
    }

    const token = await opts.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const hasBody = body !== undefined && (method === 'POST' || method === 'PUT');
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal,
      });

      return await handleResponse<T>(response, url);
    } finally {
      cleanup();
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>('GET', path, undefined, options),

    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, body, options),

    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PUT', path, body, options),

    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>('DELETE', path, undefined, options),
  };
}
