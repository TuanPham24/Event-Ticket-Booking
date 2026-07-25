import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';

type TxClient = Prisma.TransactionClient;

export interface VoucherRedemptionResult {
  voucherId: string;
  discountAmount: Prisma.Decimal;
}

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async adminCreate(dto: CreateVoucherDto) {
    return this.prisma.voucher.create({
      data: {
        code: dto.code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        totalQuantity: dto.totalQuantity,
        remainingQuantity: dto.totalQuantity,
        minOrderAmount: dto.minOrderAmount,
        maxDiscountAmount: dto.maxDiscountAmount,
        perUserLimit: dto.perUserLimit ?? 1,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
      },
    });
  }

  async adminList() {
    return this.prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * Validates and atomically redeems a voucher inside the caller's booking
   * transaction. Correctness relies on two DB-level guarantees:
   *  - the conditional UPDATE on remainingQuantity (only succeeds if > 0)
   *    prevents over-redemption under concurrency, same pattern as ticket
   *    inventory in BookingsService.
   *  - the unique (voucherId, userId) constraint on VoucherRedemption
   *    enforces perUserLimit = 1 without a race window.
   */
  async redeem(
    tx: TxClient,
    params: {
      code: string;
      userId: string;
      bookingId: string;
      orderAmount: Prisma.Decimal;
    },
  ): Promise<VoucherRedemptionResult> {
    const voucher = await tx.voucher.findUnique({
      where: { code: params.code },
    });
    if (!voucher) {
      throw new NotFoundException(`Voucher "${params.code}" not found`);
    }

    const now = new Date();
    if (now < voucher.validFrom || now > voucher.validTo) {
      throw new BadRequestException('Voucher is not valid at this time');
    }
    if (
      voucher.minOrderAmount &&
      params.orderAmount.lt(voucher.minOrderAmount)
    ) {
      throw new BadRequestException(
        `Order must be at least ${voucher.minOrderAmount.toString()} to use this voucher`,
      );
    }

    const decremented = await tx.voucher.updateMany({
      where: { id: voucher.id, remainingQuantity: { gt: 0 } },
      data: { remainingQuantity: { decrement: 1 } },
    });
    if (decremented.count === 0) {
      throw new ConflictException('Voucher is out of stock');
    }

    try {
      await tx.voucherRedemption.create({
        data: {
          voucherId: voucher.id,
          bookingId: params.bookingId,
          userId: params.userId,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You have already used this voucher');
      }
      throw err;
    }

    const discountAmount = this.computeDiscount(
      voucher.discountType,
      voucher.discountValue,
      voucher.maxDiscountAmount,
      params.orderAmount,
    );
    return { voucherId: voucher.id, discountAmount };
  }

  private computeDiscount(
    type: DiscountType,
    value: Prisma.Decimal,
    maxDiscount: Prisma.Decimal | null,
    orderAmount: Prisma.Decimal,
  ): Prisma.Decimal {
    let discount =
      type === DiscountType.PERCENTAGE
        ? orderAmount.mul(value).div(100)
        : value;
    if (maxDiscount && discount.gt(maxDiscount)) {
      discount = maxDiscount;
    }
    if (discount.gt(orderAmount)) {
      discount = orderAmount;
    }
    return discount;
  }
}
