import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

// Public self-registration always creates a CUSTOMER. OPERATOR accounts are
// seeded (see prisma/seed.ts) rather than self-service — see docs/ASSUMPTIONS.md.
export class RegisterDto {
  @ApiProperty({ example: 'customer1@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  fullName: string;
}
