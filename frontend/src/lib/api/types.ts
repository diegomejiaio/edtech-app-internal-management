/**
 * Domain types mirroring the backend Cosmos document shapes.
 * See docs/01-domain-model.md for full specification.
 */

/** Embedded snapshot of the Clerk user taken at write time. */
export interface AuditUser {
  clerkUserId: string;
  email: string;
  displayName: string;
}

/** Common fields inherited by every entity document in Cosmos. */
export interface BaseEntity {
  id: string;
  type: string;
  active: boolean;
  createdAt: string;
  createdBy: AuditUser;
  updatedAt: string;
  updatedBy: AuditUser;
  deletedAt?: string | null;
  deletedBy?: AuditUser | null;
  _etag?: string;
}

// ---------------------------------------------------------------------------
// Pagination & list conventions (see docs/04-api-design.md §1 decisions 4-6)
// ---------------------------------------------------------------------------

/** Common query parameters for paginated list endpoints. */
export interface ListParams {
  limit?: number;
  offset?: number;
  /** Single-field sort, e.g. `"createdAt:desc"`. */
  sort?: string;
  /** When `true`, includes soft-deleted records. */
  includeInactive?: boolean;
}

/** Envelope returned by paginated list endpoints. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Document identity types
//
// Wire format = camelCase (per docs/07-api-contract-cheatsheet.md §3 + §4).
// UI labels live in *_LABELS records below; render with `LABEL[value]`,
// never with the raw enum value, so backend remains the single source of
// truth for status/type strings.
// ---------------------------------------------------------------------------

/** Accepted document types for Students and Teachers (wire format). */
export type DocType = 'dni' | 'ce' | 'passport';

/** Enrollment lifecycle status (wire format, see backend `EnrollmentStatus`). */
export type EnrollmentStatus = 'active' | 'completed' | 'cancelled' | 'pending';

/** Schedule lifecycle status (wire format, see backend `ScheduleStatus`). */
export type ScheduleStatus = 'active' | 'inProgress' | 'finished' | 'cancelled';

/** Spanish UI labels for {@link DocType}. */
export const DOC_TYPE_LABELS: Record<DocType, string> = {
  dni: 'DNI',
  ce: 'CE',
  passport: 'Pasaporte',
};

/** Spanish UI labels for {@link EnrollmentStatus}. */
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
};

/** Spanish UI labels for {@link ScheduleStatus}. */
export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  active: 'Activo',
  inProgress: 'En progreso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** RFC 7807 Problem Details response shape. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}
