import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Booking } from '../../lib/types';
import { formatDateTime, formatMoney, netAmount } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .getBooking(id)
      .then(setBooking)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load booking'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handlePay() {
    if (!booking) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await api.payBooking(booking.id);
      setBooking(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Payment failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await api.cancelBooking(booking.id);
      setBooking(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cancel failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (!booking) return null;

  const isPending = booking.status === 'PENDING_PAYMENT';

  return (
    <div className="detail-page">
      <div className="page-header">
        <button className="btn btn--ghost" onClick={() => navigate('/bookings')}>
          ← Back
        </button>
        <h1>Booking {booking.id.slice(0, 8)}</h1>
        <StatusBadge status={booking.status} />
      </div>

      {isPending && booking.holdExpiresAt && (
        <div className="alert alert--info">
          Hold expires at {formatDateTime(booking.holdExpiresAt)} — pay before then or the tickets
          will be released.
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Unit price</th>
            <th>Quantity</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {booking.items.map((item) => (
            <tr key={item.id}>
              <td>{item.ticketCategory.name}</td>
              <td>{formatMoney(item.unitPrice)}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(Number(item.unitPrice) * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="booking-summary card">
        {booking.voucher && (
          <div className="booking-summary__row">
            <span>Voucher ({booking.voucher.code})</span>
            <span>-{formatMoney(booking.discountAmount)}</span>
          </div>
        )}
        <div className="booking-summary__total">
          <span>Total</span>
          <strong>{formatMoney(netAmount(booking))}</strong>
        </div>

        {actionError && <div className="alert alert--error">{actionError}</div>}

        {isPending && (
          <div className="button-row">
            <button className="btn btn--primary" disabled={actionLoading} onClick={handlePay}>
              {actionLoading ? 'Processing…' : 'Pay now'}
            </button>
            <button className="btn btn--danger" disabled={actionLoading} onClick={handleCancel}>
              Cancel booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
