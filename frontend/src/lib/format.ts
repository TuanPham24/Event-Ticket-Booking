export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export function netAmount(booking: { totalAmount: string; discountAmount: string }): number {
  return Number(booking.totalAmount) - Number(booking.discountAmount);
}
