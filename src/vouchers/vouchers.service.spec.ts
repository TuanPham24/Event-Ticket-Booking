import { BadRequestException, ConflictException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { VouchersService } from './vouchers.service';

function decimal(value: number) {
  return new Prisma.Decimal(value);
}

describe('VouchersService', () => {
  let tx: any;
  let service: VouchersService;

  const activeVoucher = {
    id: 'v-1',
    code: 'FLASH50',
    discountType: DiscountType.PERCENTAGE,
    discountValue: decimal(50),
    remainingQuantity: 1,
    minOrderAmount: null,
    maxDiscountAmount: decimal(1_000_000),
    validFrom: new Date(Date.now() - 1000),
    validTo: new Date(Date.now() + 1000 * 60 * 60),
  };

  beforeEach(() => {
    tx = {
      voucher: {
        findUnique: jest.fn().mockResolvedValue(activeVoucher),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      voucherRedemption: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new VouchersService({} as any);
  });

  it('computes a percentage discount capped by maxDiscountAmount', async () => {
    const result = await service.redeem(tx, {
      code: 'FLASH50',
      userId: 'user-1',
      bookingId: 'booking-1',
      orderAmount: decimal(10_000_000),
    });

    expect(result.voucherId).toBe('v-1');
    expect(result.discountAmount.toNumber()).toBe(1_000_000);
  });

  it('rejects redemption when the voucher is out of stock (abuse/oversell prevention)', async () => {
    tx.voucher.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.redeem(tx, {
        code: 'FLASH50',
        userId: 'user-1',
        bookingId: 'booking-1',
        orderAmount: decimal(100),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second redemption by the same user (per-user limit enforcement)', async () => {
    tx.voucherRedemption.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['voucherId', 'userId'] },
      }),
    );

    await expect(
      service.redeem(tx, {
        code: 'FLASH50',
        userId: 'user-1',
        bookingId: 'booking-1',
        orderAmount: decimal(100),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects redemption outside the voucher validity window', async () => {
    tx.voucher.findUnique.mockResolvedValue({
      ...activeVoucher,
      validTo: new Date(Date.now() - 1000),
    });

    await expect(
      service.redeem(tx, {
        code: 'FLASH50',
        userId: 'user-1',
        bookingId: 'booking-1',
        orderAmount: decimal(100),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects redemption below minOrderAmount', async () => {
    tx.voucher.findUnique.mockResolvedValue({
      ...activeVoucher,
      minOrderAmount: decimal(500),
    });

    await expect(
      service.redeem(tx, {
        code: 'FLASH50',
        userId: 'user-1',
        bookingId: 'booking-1',
        orderAmount: decimal(100),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
