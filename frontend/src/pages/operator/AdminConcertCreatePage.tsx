import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';

export function AdminConcertCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const concert = await api.adminCreateConcert({
        name,
        description: description || undefined,
        venue,
        startTime: new Date(startTime).toISOString(),
      });
      navigate(`/admin/concerts/${concert.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create concert');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="detail-page">
      <h1>New concert</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        {error && <div className="alert alert--error">{error}</div>}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Venue
          <input value={venue} onChange={(e) => setVenue(e.target.value)} required />
        </label>
        <label>
          Start time
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create concert (starts as DRAFT)'}
        </button>
      </form>
    </div>
  );
}
