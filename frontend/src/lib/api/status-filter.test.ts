/**
 * Guards the multi-status filter wire contract for fact-table lists.
 *
 * `getSchedules` / `getEnrollments` accept `status` as an array but the backend
 * expects a single comma-separated `status` query param (parsed via `EnumCsv`).
 * These tests lock in that serialization: array -> CSV, empty/undefined -> omitted.
 */

import { describe, expect, it, vi } from 'vitest';
import { getSchedules } from './schedules';
import { getEnrollments } from './enrollments';
import type { ApiClient } from './client';

function makeClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

describe('getSchedules status serialization', () => {
  it('joins multiple statuses into a comma-separated param', async () => {
    const client = makeClient();
    await getSchedules(client, { status: ['active', 'inProgress'] });

    expect(client.get).toHaveBeenCalledWith(
      '/schedules',
      expect.objectContaining({
        params: expect.objectContaining({ status: 'active,inProgress' }),
      }),
    );
  });

  it('omits status when the array is empty (show all)', async () => {
    const client = makeClient();
    await getSchedules(client, { status: [] });

    const params = (client.get as ReturnType<typeof vi.fn>).mock.calls[0][1].params;
    expect(params.status).toBeUndefined();
  });

  it('omits status when not provided', async () => {
    const client = makeClient();
    await getSchedules(client, { search: 'foo' });

    const params = (client.get as ReturnType<typeof vi.fn>).mock.calls[0][1].params;
    expect(params.status).toBeUndefined();
    expect(params.search).toBe('foo');
  });
});

describe('getEnrollments status serialization', () => {
  it('joins multiple statuses into a comma-separated param', async () => {
    const client = makeClient();
    await getEnrollments(client, { status: ['active', 'pending'] });

    expect(client.get).toHaveBeenCalledWith(
      '/enrollments',
      expect.objectContaining({
        params: expect.objectContaining({ status: 'active,pending' }),
      }),
    );
  });

  it('omits status when the array is empty (show all)', async () => {
    const client = makeClient();
    await getEnrollments(client, { status: [] });

    const params = (client.get as ReturnType<typeof vi.fn>).mock.calls[0][1].params;
    expect(params.status).toBeUndefined();
  });
});
