/**
 * Course detail page — server entry.
 *
 * Exports `generateStaticParams` (required for `output: 'export'`)
 * and renders the client view. Runtime routing is handled by SWA
 * navigationFallback + client-side hydration.
 */

import { CourseDetailView } from './course-detail-view';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function CourseDetailPage() {
  return <CourseDetailView />;
}
