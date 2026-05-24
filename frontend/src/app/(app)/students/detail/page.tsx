/**
 * Student detail page — flat static route with query-string id.
 *
 * Uses `/students/detail?id=<guid>` to stay compatible with `output: 'export'`.
 */

import { Suspense } from 'react';
import { StudentDetailView } from './student-detail-view';

export default function StudentDetailPage() {
  return (
    <Suspense fallback={null}>
      <StudentDetailView />
    </Suspense>
  );
}
