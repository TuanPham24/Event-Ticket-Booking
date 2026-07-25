import { ConflictException } from '@nestjs/common';
import { BookingStatus, DiscountType, Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

describe('BookingsService', () => {
  let prisma: any;
  let vouchers: any;
  let config: any;
  let service: BookingsService;

  const category = {
    id: 'cat-1',
    concertId: 'concert-1',
    name: 'VIP',
    price: decimal(100),
    totalQuantity: 5,
    availableQuantity: 1,
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((arg: any) => {
        if (typeof arg === 'function') {
          return arg(prisma);
        }
        return Promise.all(arg);
      }),
      ticketCategory: {
        findMany: jest.fn().mockResolvedValue([category]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(category),
      },
      booking: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      voucher: { update: jest.fn() },
      voucherRedemption: { deleteMany: jest.fn() },
    };
    vouchers = { redeem: jest.fn() };
    config = { get: jest.fn().mockReturnValue('10') };
    service = new BookingsService(prisma, vouchers, config);
  });

  describe('create', () => {
    const dto = {
      concertId: 'concert-1',
      items: [{ ticketCategoryId: 'cat-1', quantity: 1 }],
    };

    it('reserves inventory and creates a PENDING_PAYMENT booking', async () => {
      const created = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        items: [],
        voucherId: null,
      };
      prisma.booking.create.mockResolvedValue(created);

      const result = await service.create('user-1', 'key-1', dto);

      expect(prisma.ticketCategory.updateMany).toHaveBeenCalledWith({
        where: { id: 'cat-1', availableQuantity: { gte: 1 } },
        data: { availableQuantity: { decrement: 1 } },
      });
      expect(prisma.booking.create).toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it('rejects the booking when inventory is insufficient (oversell prevention)', async () => {
      prisma.ticketCategory.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.create('user-1', 'key-1', dto as any),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('returns the existing booking for a retried Idempotency-Key without reserving again', async () => {
      const existing = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      };
      prisma.booking.findUnique.mockResolvedValue(existing);

      const result = await service.create('user-1', 'key-1', dto);

      expect(result).toBe(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.ticketCategory.updateMany).not.toHaveBeenCalled();
    });

    it('recovers from a racing duplicate insert by returning the winning booking', async () => {
      const winner = { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT };
      // First lookup (pre-transaction fast path) finds nothing; the concurrent
      // request wins the INSERT race, so our own create() throws P2002; the
      // post-catch lookup then finds the winner's row.
      prisma.booking.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner);
      prisma.booking.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['userId', 'idempotencyKey'] },
        }),
      );

      const result = await service.create('user-1', 'key-1', dto);

      expect(result).toBe(winner);
    });

    it('applies a voucher and reflects the discount on the booking', async () => {
      const created = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        totalAmount: decimal(100),
      };
      const updated = {
        ...created,
        voucherId: 'v-1',
        discountAmount: decimal(50),
      };
      prisma.booking.create.mockResolvedValue(created);
      prisma.booking.update.mockResolvedValue(updated);
      vouchers.redeem.mockResolvedValue({
        voucherId: 'v-1',
        discountAmount: decimal(50),
      });

      const result = await service.create('user-1', 'key-1', {
        ...dto,
        voucherCode: 'FLASH50',
      });

      expect(vouchers.redeem).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          code: 'FLASH50',
          userId: 'user-1',
          bookingId: 'booking-1',
        }),
      );
      expect(result).toBe(updated);
    });
  });

  describe('expireStaleHolds', () => {
    it('restores ticket inventory and voucher stock for stale holds', async () => {
      const staleBooking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        voucherId: 'v-1',
        items: [{ ticketCategoryId: 'cat-1', quantity: 2 }],
      };
      prisma.booking.findMany.mockResolvedValue([staleBooking]);
      prisma.booking.update.mockResolvedValue({
        ...staleBooking,
        status: BookingStatus.EXPIRED,
      });

      const count = await service.expireStaleHolds();

      expect(prisma.ticketCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { availableQuantity: { increment: 2 } },
      });
      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { remainingQuantity: { increment: 1 } },
      });
      expect(prisma.voucherRedemption.deleteMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
      });
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: BookingStatus.EXPIRED, holdExpiresAt: null },
        }),
      );
      expect(count).toBe(1);
    });
  });
});

describe('DiscountType sanity', () => {
  it('is exported from the Prisma client', () => {
    expect(DiscountType.PERCENTAGE).toBe('PERCENTAGE');
  });
});
