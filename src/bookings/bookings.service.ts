import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQuery } from './dto/list-bookings.query';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

type TxClient = Prisma.TransactionClient;

const BOOKING_INCLUDE = {
  items: { include: { ticketCategory: true } },
  voucher: true,
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  private readonly holdMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchersService: VouchersService,
    config: ConfigService,
  ) {
    this.holdMinutes = Number(config.get('BOOKING_HOLD_MINUTES', '10'));
  }

  // --- Customer-facing ---

  async create(userId: string, idempotencyKey: string, dto: CreateBookingDto) {
    const existing = await this.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const categories = await tx.ticketCategory.findMany({
          where: {
            id: { in: dto.items.map((i) => i.ticketCategoryId) },
            concertId: dto.concertId,
          },
        });
        const categoryById = new Map(categories.map((c) => [c.id, c]));
        if (
          categoryById.size !==
          new Set(dto.items.map((i) => i.ticketCategoryId)).size
        ) {
          throw new NotFoundException(
            'One or more ticket categories were not found for this concert',
          );
        }

        // Atomic conditional decrement per category: this single UPDATE is
        // what prevents overselling under concurrent requests (see docs/architecture.md).
        for (const item of dto.items) {
          const result = await tx.ticketCategory.updateMany({
            where: {
              id: item.ticketCategoryId,
              availableQuantity: { gte: item.quantity },
            },
            data: { availableQuantity: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            const category = categoryById.get(item.ticketCategoryId)!;
            throw new ConflictException(
              `Not enough "${category.name}" tickets available`,
            );
          }
        }

        const totalAmount = dto.items.reduce((sum, item) => {
          const category = categoryById.get(item.ticketCategoryId)!;
          return sum.add(category.price.mul(item.quantity));
        }, new Prisma.Decimal(0));

        let booking = await tx.booking.create({
          data: {
            userId,
            concertId: dto.concertId,
            idempotencyKey,
            status: BookingStatus.PENDING_PAYMENT,
            totalAmount,
            holdExpiresAt: new Date(Date.now() + this.holdMinutes * 60_000),
            items: {
              create: dto.items.map((item) => ({
                ticketCategoryId: item.ticketCategoryId,
                quantity: item.quantity,
                unitPrice: categoryById.get(item.ticketCategoryId)!.price,
              })),
            },
          },
          include: BOOKING_INCLUDE,
        });

        if (dto.voucherCode) {
          const { voucherId, discountAmount } =
            await this.vouchersService.redeem(tx, {
              code: dto.voucherCode,
              userId,
              bookingId: booking.id,
              orderAmount: totalAmount,
            });
          booking = await tx.booking.update({
            where: { id: booking.id },
            data: { voucherId, discountAmount },
            include: BOOKING_INCLUDE,
          });
        }

        return booking;
      });
    } catch (err) {
      if (this.isIdempotencyKeyConflict(err)) {
        const retried = await this.findByIdempotencyKey(userId, idempotencyKey);
        if (retried) {
          return retried;
        }
      }
      throw err;
    }
  }

  async pay(userId: string, bookingId: string) {
    const booking = await this.getOwnedBooking(userId, bookingId);
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot pay a booking with status ${booking.status}`,
      );
    }
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      throw new BadRequestException(
        'Booking hold has expired, please create a new booking',
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED, holdExpiresAt: null },
      include: BOOKING_INCLUDE,
    });
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.getOwnedBooking(userId, bookingId);
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot cancel a booking with status ${booking.status}`,
      );
    }
    return this.prisma.$transaction((tx) =>
      this.releaseBooking(tx, booking, BookingStatus.CANCELLED),
    );
  }

  async findOne(userId: string, bookingId: string) {
    return this.getOwnedBooking(userId, bookingId);
  }

  async findMine(userId: string, query: ListBookingsQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: { userId },
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  // --- Admin / operation dashboard ---

  async adminList(query: ListBookingsQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.BookingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.concertId && { concertId: query.concertId }),
      ...(query.suspicious && {
        status: { in: [BookingStatus.FAILED, BookingStatus.EXPIRED] },
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: {
          ...BOOKING_INCLUDE,
          user: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async adminUpdateStatus(bookingId: string, dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prisma.$transaction((tx) => {
      const releasingStatuses: BookingStatus[] = [
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
        BookingStatus.FAILED,
      ];
      if (
        booking.status === BookingStatus.PENDING_PAYMENT &&
        releasingStatuses.includes(dto.status)
      ) {
        return this.releaseBooking(tx, booking, dto.status);
      }
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: dto.status, holdExpiresAt: null },
        include: BOOKING_INCLUDE,
      });
    });
  }

  // --- Expiry sweep ---

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireStaleHolds() {
    const stale = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lt: new Date() },
      },
      include: BOOKING_INCLUDE,
    });
    for (const booking of stale) {
      await this.prisma.$transaction((tx) =>
        this.releaseBooking(tx, booking, BookingStatus.EXPIRED),
      );
    }
    return stale.length;
  }

  // --- Internal helpers ---

  private async releaseBooking(
    tx: TxClient,
    booking: Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>,
    status: BookingStatus,
  ) {
    for (const item of booking.items) {
      await tx.ticketCategory.update({
        where: { id: item.ticketCategoryId },
        data: { availableQuantity: { increment: item.quantity } },
      });
    }
    if (booking.voucherId) {
      await tx.voucher.update({
        where: { id: booking.voucherId },
        data: { remainingQuantity: { increment: 1 } },
      });
      await tx.voucherRedemption.deleteMany({
        where: { bookingId: booking.id },
      });
    }
    return tx.booking.update({
      where: { id: booking.id },
      data: { status, holdExpiresAt: null },
      include: BOOKING_INCLUDE,
    });
  }

  private async getOwnedBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.userId !== userId) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  private async findByIdempotencyKey(userId: string, idempotencyKey: string) {
    return this.prisma.booking.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: BOOKING_INCLUDE,
    });
  }

  private isIdempotencyKeyConflict(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      (err.meta?.target as string[] | undefined)?.includes('idempotencyKey') ===
        true
    );
  }
}
