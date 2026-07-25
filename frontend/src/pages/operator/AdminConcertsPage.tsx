import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Concert } from '../../lib/types';
import { formatDateTime } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

export function AdminConcertsPage() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminListConcerts()
      .then(setConcerts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load concerts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Concerts</h1>
        <Link to="/admin/concerts/new" className="btn btn--primary">
          New concert
        </Link>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p>Loading…</p>}
      {!loading && concerts.length === 0 && <p className="empty-state">No concerts yet.</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Venue</th>
            <th>Starts</th>
            <th>Status</th>
            <th>Ticket categories</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {concerts.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.venue}</td>
              <td>{formatDateTime(c.startTime)}</td>
              <td>
                <StatusBadge status={c.status} />
              </td>
              <td>{c.ticketCategories.length}</td>
              <td>
                <Link to={`/admin/concerts/${c.id}`} className="btn btn--ghost">
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
