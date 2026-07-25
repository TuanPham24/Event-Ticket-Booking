import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookingItemDto {
  @ApiProperty({ example: 'clx0000000000ticketcategory' })
  @IsString()
  ticketCategoryId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingDto {
  @ApiProperty({ example: 'clx0000000000concert' })
  @IsString()
  concertId: string;

  @ApiProperty({ type: [BookingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

  @ApiProperty({ example: 'FLASH50', required: false })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
