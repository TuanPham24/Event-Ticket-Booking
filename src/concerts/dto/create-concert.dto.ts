import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateConcertDto {
  @ApiProperty({ example: 'Imagine Dragons Live in Saigon' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'A high-energy night of alternative rock.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Quan Khu 7 Stadium, Ho Chi Minh City' })
  @IsString()
  venue: string;

  @ApiProperty({ example: '2026-11-15T12:00:00.000Z' })
  @IsDateString()
  startTime: string;
}
