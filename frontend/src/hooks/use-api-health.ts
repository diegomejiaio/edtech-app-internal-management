'use client';

import { useQuery } from '@tanstack/react-query';
import { getHealth, type ApiClient, type HealthResponse } from '@/lib/api';

export function useApiHealth(client: ApiClient) {
  return useQuery<HealthResponse>({
    queryKey: ['api', 'health'],
    queryFn: () => getHealth(client),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
