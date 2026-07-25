import { statusLabel } from '../lib/format';

const STATUS_CLASS: Record<string, string> = {
  PENDING_PAYMENT: 'badge--pending',
  CONFIRMED: 'badge--success',
  CANCELLED: 'badge--neutral',
  EXPIRED: 'badge--warn',
  FAILED: 'badge--error',
  DRAFT: 'badge--neutral',
  PUBLISHED: 'badge--success',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'badge--neutral'}`}>{statusLabel(status)}</span>;
}
