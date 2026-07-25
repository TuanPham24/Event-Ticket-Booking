import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Concert } from '../../lib/types';
import { formatDateTime, formatMoney } from '../../lib/format';

export function ConcertsPage() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(9);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listConcerts(page, pageSize)
      .then((res) => {
        if (cancelled) return;
        setConcerts(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load concerts'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="page-header">
        <h1>Concerts</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p>Loading…</p>}
      {!loading && concerts.length === 0 && <p className="empty-state">No concerts published yet.</p>}

      <div className="card-grid">
        {concerts.map((concert) => {
          const cheapest = concert.ticketCategories.reduce<number | null>((min, tc) => {
            const price = Number(tc.price);
            return min === null || price < min ? price : min;
          }, null);
          const soldOut = concert.ticketCategories.every((tc) => tc.availableQuantity === 0);
          return (
            <Link to={`/concerts/${concert.id}`} className="card concert-card" key={concert.id}>
              <h2>{concert.name}</h2>
              <p className="concert-card__meta">{concert.venue}</p>
              <p className="concert-card__meta">{formatDateTime(concert.startTime)}</p>
              <div className="concert-card__footer">
                <span>{cheapest !== null ? `from ${formatMoney(cheapest)}` : 'No tickets'}</span>
                {soldOut && <span className="badge badge--warn">Sold out</span>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pagination">
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          className="btn"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
