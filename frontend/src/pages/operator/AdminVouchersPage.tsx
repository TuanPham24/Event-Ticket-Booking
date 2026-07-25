import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import type { DiscountType, Voucher } from '../../lib/types';
import { formatDateTime, formatMoney } from '../../lib/format';

const emptyForm = {
  code: '',
  discountType: 'PERCENTAGE' as DiscountType,
  discountValue: '',
  totalQuantity: '',
  minOrderAmount: '',
  maxDiscountAmount: '',
  perUserLimit: '1',
  validFrom: '',
  validTo: '',
};

export function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .adminListVouchers()
      .then(setVouchers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load vouchers'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api.adminCreateVoucher({
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        totalQuantity: Number(form.totalQuantity),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
        validFrom: new Date(form.validFrom).toISOString(),
        validTo: new Date(form.validTo).toISOString(),
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create voucher');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Vouchers</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {loading && <p>Loading…</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount</th>
            <th>Remaining</th>
            <th>Per user</th>
            <th>Valid</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr key={v.id}>
              <td>{v.code}</td>
              <td>
                {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatMoney(v.discountValue)}
              </td>
              <td>
                {v.remainingQuantity} / {v.totalQuantity}
              </td>
              <td>{v.perUserLimit}</td>
              <td>
                {formatDateTime(v.validFrom)} → {formatDateTime(v.validTo)}
              </td>
            </tr>
          ))}
          {!loading && vouchers.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-state">
                No vouchers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Create voucher</h2>
      <form className="form-card" onSubmit={handleCreate}>
        {createError && <div className="alert alert--error">{createError}</div>}
        <label>
          Code
          <input value={form.code} onChange={(e) => update('code', e.target.value)} required />
        </label>
        <label>
          Discount type
          <select
            value={form.discountType}
            onChange={(e) => update('discountType', e.target.value as DiscountType)}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </label>
        <label>
          Discount value {form.discountType === 'PERCENTAGE' ? '(0-100)' : '(VND)'}
          <input
            type="number"
            min={0}
            value={form.discountValue}
            onChange={(e) => update('discountValue', e.target.value)}
            required
          />
        </label>
        <label>
          Total quantity
          <input
            type="number"
            min={1}
            value={form.totalQuantity}
            onChange={(e) => update('totalQuantity', e.target.value)}
            required
          />
        </label>
        <label>
          Min order amount (optional)
          <input
            type="number"
            min={0}
            value={form.minOrderAmount}
            onChange={(e) => update('minOrderAmount', e.target.value)}
          />
        </label>
        <label>
          Max discount amount (optional, PERCENTAGE cap)
          <input
            type="number"
            min={0}
            value={form.maxDiscountAmount}
            onChange={(e) => update('maxDiscountAmount', e.target.value)}
          />
        </label>
        <label>
          Per-user limit
          <input
            type="number"
            min={1}
            value={form.perUserLimit}
            onChange={(e) => update('perUserLimit', e.target.value)}
          />
        </label>
        <label>
          Valid from
          <input
            type="datetime-local"
            value={form.validFrom}
            onChange={(e) => update('validFrom', e.target.value)}
            required
          />
        </label>
        <label>
          Valid to
          <input
            type="datetime-local"
            value={form.validTo}
            onChange={(e) => update('validTo', e.target.value)}
            required
          />
        </label>
        <button className="btn btn--primary" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create voucher'}
        </button>
      </form>
    </div>
  );
}
