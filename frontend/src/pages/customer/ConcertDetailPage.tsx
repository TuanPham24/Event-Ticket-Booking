import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Concert } from '../../lib/types';
import { formatDateTime, formatMoney } from '../../lib/format';

export function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [voucherCode, setVoucherCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getConcert(id)
      .then(setConcert)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load concert'))
      .finally(() => setLoading(false));
  }, [id]);

  function setQuantity(ticketCategoryId: string, quantity: number, max: number) {
    const clamped = Math.max(0, Math.min(quantity, max));
    setQuantities((prev) => ({ ...prev, [ticketCategoryId]: clamped }));
  }

  const items = Object.entries(quantities).filter(([, qty]) => qty > 0);
  const subtotal = items.reduce((sum, [ticketCategoryId, qty]) => {
    const tc = concert?.ticketCategories.find((t) => t.id === ticketCategoryId);
    return sum + (tc ? Number(tc.price) * qty : 0);
  }, 0);

  async function handleBook() {
    if (!concert || items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await api.createBooking({
        concertId: concert.id,
        items: items.map(([ticketCategoryId, quantity]) => ({ ticketCategoryId, quantity })),
        voucherCode: voucherCode.trim() || undefined,
      });
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (!concert) return null;

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>{concert.name}</h1>
        <p className="concert-card__meta">{concert.venue}</p>
        <p className="concert-card__meta">{formatDateTime(concert.startTime)}</p>
      </div>
      {concert.description && <p>{concert.description}</p>}

      <h2>Ticket categories</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Price</th>
            <th>Available</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {concert.ticketCategories.map((tc) => (
            <tr key={tc.id}>
              <td>{tc.name}</td>
              <td>{formatMoney(tc.price)}</td>
              <td>{tc.availableQuantity}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={tc.availableQuantity}
                  disabled={tc.availableQuantity === 0}
                  value={quantities[tc.id] ?? 0}
                  onChange={(e) => setQuantity(tc.id, Number(e.target.value), tc.availableQuantity)}
                  className="qty-input"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="booking-summary card">
        <label>
          Voucher code (optional)
          <input
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
            placeholder="e.g. FLASH50"
          />
        </label>
        <div className="booking-summary__total">
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>
        {submitError && <div className="alert alert--error">{submitError}</div>}
        <button
          className="btn btn--primary"
          disabled={items.length === 0 || submitting}
          onClick={handleBook}
        >
          {submitting ? 'Booking…' : 'Reserve tickets'}
        </button>
      </div>
    </div>
  );
}
