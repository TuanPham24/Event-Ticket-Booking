export type Role = 'CUSTOMER' | 'OPERATOR';

export type ConcertStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface TicketCategory {
  id: string;
  concertId: string;
  name: string;
  price: string;
  totalQuantity: number;
  availableQuantity: number;
  createdAt: string;
}

export interface Concert {
  id: string;
  name: string;
  description: string | null;
  venue: string;
  startTime: string;
  status: ConcertStatus;
  createdAt: string;
  updatedAt: string;
  ticketCategories: TicketCategory[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Voucher {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  totalQuantity: number;
  remainingQuantity: number;
  minOrderAmount: string | null;
  maxDiscountAmount: string | null;
  perUserLimit: number;
  validFrom: string;
  validTo: string;
  createdAt: string;
}

export interface BookingItem {
  id: string;
  bookingId: string;
  ticketCategoryId: string;
  quantity: number;
  unitPrice: string;
  ticketCategory: TicketCategory;
}

export interface Booking {
  id: string;
  userId: string;
  concertId: string;
  status: BookingStatus;
  totalAmount: string;
  discountAmount: string;
  voucherId: string | null;
  idempotencyKey: string;
  holdExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
  voucher: Voucher | null;
  user?: { id: string; email: string; fullName: string };
}
