import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, example: BookingStatus.CANCELLED })
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @ApiProperty({
    example: 'Customer reported a failed payment gateway callback',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
