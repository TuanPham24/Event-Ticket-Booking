import { ApiProperty } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateVoucherDto {
  @ApiProperty({ example: 'FLASH50' })
  @IsString()
  code: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    example: 50,
    description: 'Percentage (0-100) if PERCENTAGE, absolute amount if FIXED',
  })
  @IsNumber()
  @IsPositive()
  discountValue: number;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  totalQuantity: number;

  @ApiProperty({ example: 200000, required: false })
  @IsOptional()
  @IsNumber()
  minOrderAmount?: number;

  @ApiProperty({
    example: 300000,
    required: false,
    description: 'Cap on discount amount for PERCENTAGE vouchers',
  })
  @IsOptional()
  @IsNumber()
  maxDiscountAmount?: number;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiProperty({ example: '2026-11-01T00:00:00.000Z' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ example: '2026-11-30T23:59:59.000Z' })
  @IsDateString()
  validTo: string;
}
