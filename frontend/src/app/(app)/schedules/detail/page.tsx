/**
 * Schedule detail page — flat static route with query-string id.
 *
 * Uses `/schedules/detail?id=<guid>` to stay compatible with `output: 'export'`
 * (no `generateStaticParams` needed, no dynamic segment to prerender).
 *
 * The client view reads the id via `useSearchParams`, which must be wrapped
 * in <Suspense> for static prerendering.
 */

import { Suspense } from 'react';
import { ScheduleDetailView } from './schedule-detail-view';

export default function ScheduleDetailPage() {
  return (
    <Suspense fallback={null}>
      <ScheduleDetailView />
    </Suspense>
  );
}
