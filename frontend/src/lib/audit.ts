import type { AuditUser } from '@/lib/api';
import { formatDateOnly } from '@/lib/dates';

export function formatAuditMetadata(
  user: AuditUser | null | undefined,
  date: string | null | undefined,
): string {
  if (!user?.displayName || !date) return '—';
  return `${user.displayName} · ${formatDateOnly(date)}`;
}
