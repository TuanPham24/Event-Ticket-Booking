import type {
  AuthResponse,
  Booking,
  BookingStatus,
  Concert,
  Paginated,
  TicketCategory,
  Voucher,
} from './types';

const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Auth endpoints must never trigger the auto-refresh below: refreshing on a
// failed login/refresh/logout would either loop or mask the real error.
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

// The access token is short-lived; when it expires the browser gets a 401. We
// silently POST /auth/refresh once and retry the original request, so the user
// never sees the expiry. Single-flighted so a burst of concurrent 401s shares
// one refresh call instead of stampeding the endpoint.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      // The access token lives in an httpOnly cookie set by the backend — this
      // makes the browser attach it automatically instead of us reading it
      // from JS and adding an Authorization header.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  // On an expired access token, try one transparent refresh + retry.
  if (res.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await doFetch();
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? `Request failed with status ${res.status}`);
    throw new ApiError(res.status, message);
  }

  return data as T;
}

function makeIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const api = {
  // --- Auth ---
  register: (dto: { email: string; password: string; fullName: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: dto }),
  login: (dto: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: dto }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST' }),
  me: () => request<AuthResponse>('/auth/me'),

  // --- Concerts (public) ---
  listConcerts: (page = 1, pageSize = 20) =>
    request<Paginated<Concert>>(`/concerts?page=${page}&pageSize=${pageSize}`),
  getConcert: (id: string) => request<Concert>(`/concerts/${id}`),

  // --- Bookings (customer) ---
  createBooking: (dto: {
    concertId: string;
    items: { ticketCategoryId: string; quantity: number }[];
    voucherCode?: string;
  }) =>
    request<Booking>('/bookings', {
      method: 'POST',
      body: dto,
      headers: { 'Idempotency-Key': makeIdempotencyKey() },
    }),
  listMyBookings: (params: {
    status?: BookingStatus;
    concertId?: string;
    suspicious?: boolean;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.concertId) qs.set('concertId', params.concertId);
    if (params.suspicious !== undefined) qs.set('suspicious', String(params.suspicious));
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    return request<Paginated<Booking>>(`/bookings?${qs.toString()}`);
  },
  getBooking: (id: string) => request<Booking>(`/bookings/${id}`),
  payBooking: (id: string) => request<Booking>(`/bookings/${id}/pay`, { method: 'POST' }),
  cancelBooking: (id: string) => request<Booking>(`/bookings/${id}/cancel`, { method: 'POST' }),

  // --- Admin: concerts ---
  adminListConcerts: () => request<Concert[]>('/admin/concerts'),
  adminGetConcert: (id: string) => request<Concert>(`/admin/concerts/${id}`),
  adminCreateConcert: (dto: {
    name: string;
    description?: string;
    venue: string;
    startTime: string;
  }) => request<Concert>('/admin/concerts', { method: 'POST', body: dto }),
  adminUpdateConcert: (
    id: string,
    dto: Partial<{ name: string; description: string; venue: string; startTime: string }>,
  ) => request<Concert>(`/admin/concerts/${id}`, { method: 'PATCH', body: dto }),
  adminPublishConcert: (id: string) =>
    request<Concert>(`/admin/concerts/${id}/publish`, { method: 'PATCH' }),
  adminCreateTicketCategory: (
    concertId: string,
    dto: { name: string; price: number; totalQuantity: number },
  ) =>
    request<TicketCategory>(`/admin/concerts/${concertId}/ticket-categories`, {
      method: 'POST',
      body: dto,
    }),

  // --- Admin: vouchers ---
  adminListVouchers: () => request<Voucher[]>('/admin/vouchers'),
  adminCreateVoucher: (dto: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    totalQuantity: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    perUserLimit?: number;
    validFrom: string;
    validTo: string;
  }) => request<Voucher>('/admin/vouchers', { method: 'POST', body: dto }),

  // --- Admin: bookings ---
  adminListBookings: (params: {
    status?: BookingStatus;
    concertId?: string;
    suspicious?: boolean;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.concertId) qs.set('concertId', params.concertId);
    if (params.suspicious !== undefined) qs.set('suspicious', String(params.suspicious));
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    return request<Paginated<Booking>>(`/admin/bookings?${qs.toString()}`);
  },
  adminUpdateBookingStatus: (id: string, dto: { status: BookingStatus; reason?: string }) =>
    request<Booking>(`/admin/bookings/${id}/status`, { method: 'PATCH', body: dto }),
};
