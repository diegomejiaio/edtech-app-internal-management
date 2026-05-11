'use client';

import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@/lib/api';

/**
 * Returns a memoized {@link ApiClient} wired to the current Clerk session.
 *
 * The token is fetched lazily on each request, so the client stays valid
 * across Clerk token refreshes without re-creating the instance.
 */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  return useMemo(
    () => createApiClient({ getToken: () => getToken() }),
    [getToken],
  );
}
