import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { ListBookingsQuery } from './dto/list-bookings.query';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Bookings (Admin)')
@ApiBearerAuth()
@Roles(Role.OPERATOR)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Monitor bookings, with filters for status / concert / suspicious (failed or expired)',
  })
  list(@Query() query: ListBookingsQuery) {
    return this.bookingsService.adminList(query);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Manually update a booking status (e.g. to resolve a failed or suspicious booking)',
  })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.adminUpdateStatus(id, dto);
  }
}
