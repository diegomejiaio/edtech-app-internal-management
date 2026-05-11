# API Client — Espacio Pro

Typed HTTP client for communication between the Next.js frontend and the Azure Functions backend.

## Setup

Copy `.env.local.example` to `.env.local` at the `frontend/` root and fill in the values:

```env
NEXT_PUBLIC_API_URL=http://localhost:7071
NEXT_PUBLIC_API_VERSION=v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Usage with Clerk

The client is **framework-agnostic** — it receives a `getToken` function instead of importing Clerk directly. The Clerk-wired hook lives at `src/hooks/use-api-client.ts`:

```tsx
'use client';

import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@/lib/api';

export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  return useMemo(
    () => createApiClient({ getToken: () => getToken() }),
    [getToken],
  );
}
```

Then consume it in components:

```tsx
'use client';

import { useApiClient } from '@/hooks/use-api-client';
import { useApiHealth } from '@/hooks/use-api-health';

function HealthStatus() {
  const api = useApiClient();
  const { data, isLoading, error } = useApiHealth(api);

  if (isLoading) return <p>Checking API…</p>;
  if (error) return <p>API unreachable</p>;
  return <p>API {data?.status} — v{data?.version}</p>;
}
```

## Error Handling

All non-2xx responses throw an `ApiError` containing a `ProblemDetails` body (RFC 7807):

```ts
import { isApiError, isNotFound, isConflict, isValidation } from '@/lib/api';

try {
  await api.post('/students', payload);
} catch (err) {
  if (isConflict(err)) {
    // Duplicate docType + docNumber
  } else if (isValidation(err)) {
    // 422 — field-level errors in err.problem
  } else if (isNotFound(err)) {
    // 404
  } else if (isApiError(err)) {
    // Any other API error
    console.error(err.problem.detail);
  } else {
    throw err; // Network error, timeout, etc.
  }
}
```

## Concurrency Control (ETag)

The backend uses Cosmos `_etag` for optimistic concurrency on `PUT` requests. Pass the entity's current `_etag` via the `ifMatch` option:

```ts
await api.put(`/students/${student.id}`, updatedStudent, {
  ifMatch: student._etag,
});
```

If the document was modified since the last read, the backend returns `409 Conflict`.

## Architecture Notes

- **No Next.js or Clerk imports** inside `client.ts` — it works in any React (or non-React) environment.
- **AbortController timeout**: every request has a 30 s default timeout, overridable per-request via `timeoutMs`.
- **204 No Content**: returned as `undefined` (e.g. successful `DELETE`).
