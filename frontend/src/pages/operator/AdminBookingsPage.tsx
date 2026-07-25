import { useEffect, useState } from 'react';
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

export function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [concertId, setConcertId] = useState('');
  const [suspicious, setSuspicious] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<BookingStatus>('CANCELLED');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .adminListBookings({
        status: status || undefined,
        concertId: concertId || undefined,
        suspicious: suspicious || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setBookings(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load bookings'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, concertId, suspicious, page, pageSize]);

  function startEdit(b: Booking) {
    setEditingId(b.id);
    setNewStatus(b.status === 'PENDING_PAYMENT' ? 'CANCELLED' : b.status);
    setReason('');
    setSaveError(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setSaveError(null);
    try {
      await api.adminUpdateBookingStatus(id, { status: newStatus, reason: reason || undefined });
      setEditingId(null);
      load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="page-header">
        <h1>Bookings</h1>
      </div>

      <div className="filter-bar">
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
        <input
          placeholder="Filter by concert ID"
          value={concertId}
          onChange={(e) => {
            setConcertId(e.target.value);
            setPage(1);
          }}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={suspicious}
            onChange={(e) => {
              setSuspicious(e.target.checked);
              setPage(1);
            }}
          />
          Suspicious only (failed/expired)
        </label>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p>Loading…</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Items</th>
            <th>Status</th>
            <th>Total</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.user?.fullName ?? b.userId}</td>
              <td>{b.items.map((i) => `${i.ticketCategory.name} x${i.quantity}`).join(', ')}</td>
              <td>
                <StatusBadge status={b.status} />
              </td>
              <td>{formatMoney(netAmount(b))}</td>
              <td>{formatDateTime(b.createdAt)}</td>
              <td>
                <button className="btn btn--ghost" onClick={() => startEdit(b)}>
                  Update status
                </button>
              </td>
            </tr>
          ))}
          {!loading && bookings.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-state">
                No bookings found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {editingId && (
        <div className="modal-backdrop" onClick={() => setEditingId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Update booking status</h2>
            {saveError && <div className="alert alert--error">{saveError}</div>}
            <label>
              New status
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as BookingStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reason (optional)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </label>
            <div className="button-row">
              <button className="btn btn--primary" disabled={saving} onClick={() => handleSave(editingId)}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
