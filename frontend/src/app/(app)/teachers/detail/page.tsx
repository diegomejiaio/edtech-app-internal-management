/**
 * Teacher detail page — flat static route with query-string id.
 *
 * Uses `/teachers/detail?id=<guid>` to stay compatible with `output: 'export'`.
 */

import { Suspense } from 'react';
import { TeacherDetailView } from './teacher-detail-view';

export default function TeacherDetailPage() {
  return (
    <Suspense fallback={null}>
      <TeacherDetailView />
    </Suspense>
  );
}
