import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import type { Concert } from '../../lib/types';
import { formatMoney } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [catName, setCatName] = useState('');
  const [catPrice, setCatPrice] = useState('');
  const [catQty, setCatQty] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .adminGetConcert(id)
      .then((c) => {
        setConcert(c);
        setName(c.name);
        setDescription(c.description ?? '');
        setVenue(c.venue);
        setStartTime(toDatetimeLocal(c.startTime));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load concert'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const updated = await api.adminUpdateConcert(id, {
        name,
        description,
        venue,
        startTime: new Date(startTime).toISOString(),
      });
      setConcert(updated);
    } catch (err) {
      setDetailsError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setAddingCategory(true);
    setCategoryError(null);
    try {
      await api.adminCreateTicketCategory(id, {
        name: catName,
        price: Number(catPrice),
        totalQuantity: Number(catQty),
      });
      setCatName('');
      setCatPrice('');
      setCatQty('');
      load();
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : 'Failed to add category');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const updated = await api.adminPublishConcert(id);
      setConcert(updated);
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (!concert) return null;

  return (
    <div className="detail-page">
      <div className="page-header">
        <h1>{concert.name}</h1>
        <StatusBadge status={concert.status} />
      </div>

      <h2>Details</h2>
      <form className="form-card" onSubmit={handleSaveDetails}>
        {detailsError && <div className="alert alert--error">{detailsError}</div>}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
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
        <button className="btn btn--primary" type="submit" disabled={savingDetails}>
          {savingDetails ? 'Saving…' : 'Save details'}
        </button>
      </form>

      <h2>Ticket categories</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Total</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {concert.ticketCategories.map((tc) => (
            <tr key={tc.id}>
              <td>{tc.name}</td>
              <td>{formatMoney(tc.price)}</td>
              <td>{tc.totalQuantity}</td>
              <td>{tc.availableQuantity}</td>
            </tr>
          ))}
          {concert.ticketCategories.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-state">
                No ticket categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="form-card form-card--inline" onSubmit={handleAddCategory}>
        {categoryError && <div className="alert alert--error">{categoryError}</div>}
        <label>
          Name
          <input value={catName} onChange={(e) => setCatName(e.target.value)} required />
        </label>
        <label>
          Price (VND)
          <input
            type="number"
            min={0}
            value={catPrice}
            onChange={(e) => setCatPrice(e.target.value)}
            required
          />
        </label>
        <label>
          Total quantity
          <input
            type="number"
            min={1}
            value={catQty}
            onChange={(e) => setCatQty(e.target.value)}
            required
          />
        </label>
        <button className="btn" type="submit" disabled={addingCategory}>
          {addingCategory ? 'Adding…' : 'Add category'}
        </button>
      </form>

      <h2>Publish</h2>
      {publishError && <div className="alert alert--error">{publishError}</div>}
      {concert.status === 'DRAFT' ? (
        <button
          className="btn btn--primary"
          onClick={handlePublish}
          disabled={publishing || concert.ticketCategories.length === 0}
        >
          {publishing ? 'Publishing…' : 'Publish concert'}
        </button>
      ) : (
        <p className="empty-state">This concert is {concert.status.toLowerCase()}.</p>
      )}
      {concert.status === 'DRAFT' && concert.ticketCategories.length === 0 && (
        <p className="hint">Add at least one ticket category before publishing.</p>
      )}
    </div>
  );
}
