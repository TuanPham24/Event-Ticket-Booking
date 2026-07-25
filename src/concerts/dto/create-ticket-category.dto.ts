import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CreateTicketCategoryDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1500000, description: 'Price in VND' })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ example: 200 })
  @IsInt()
  @Min(1)
  totalQuantity: number;
}
