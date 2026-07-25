import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQuery } from './dto/list-bookings.query';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Bookings (Public)')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated key; retried requests with the same key return the original booking',
  })
  @ApiOperation({
    summary: 'Reserve tickets for a concert (optionally applying a voucher)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto: CreateBookingDto,
  ) {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || Array.isArray(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.bookingsService.create(user.userId, idempotencyKey, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my bookings' })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBookingsQuery,
  ) {
    return this.bookingsService.findMine(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Track the status of a booking' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.findOne(user.userId, id);
  }

  @Post(':id/pay')
  @ApiOperation({
    summary:
      'Simulate a successful payment, confirming the booking (no real payment gateway integration)',
  })
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.pay(user.userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a pending (unpaid) booking, releasing its tickets/voucher',
  })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.cancel(user.userId, id);
  }
}
