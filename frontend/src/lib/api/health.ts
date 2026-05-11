import type { ApiClient } from './client';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}

export const getHealth = (client: ApiClient): Promise<HealthResponse> =>
  client.get<HealthResponse>('/health');
