import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Booking, BookingStatus } from '../../lib/types';
import { formatDateTime, formatMoney, netAmount } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

const STATUS_OPTIONS: BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
];

export function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listMyBookings({ status: status || undefined, page, pageSize })
      .then((res) => {
        if (cancelled) return;
        setBookings(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load bookings'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="page-header">
        <h1>My Bookings</h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BookingStatus | '');
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p>Loading…</p>}
      {!loading && bookings.length === 0 && <p className="empty-state">No bookings found.</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Booking</th>
            <th>Status</th>
            <th>Total</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.items.map((i) => `${i.ticketCategory.name} x${i.quantity}`).join(', ')}</td>
              <td>
                <StatusBadge status={b.status} />
              </td>
              <td>{formatMoney(netAmount(b))}</td>
              <td>{formatDateTime(b.createdAt)}</td>
              <td>
                <Link to={`/bookings/${b.id}`} className="btn btn--ghost">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
