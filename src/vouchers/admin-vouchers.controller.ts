import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { Roles } from '../common/decorators/roles.decorator';

// Create/list only — no update or delete. See docs/ASSUMPTIONS.md for the
// deliberate scope cut (matches the assignment's own example of acceptable scoping).
@ApiTags('Vouchers (Admin)')
@ApiBearerAuth()
@Roles(Role.OPERATOR)
@Controller('admin/vouchers')
export class AdminVouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Get()
  @ApiOperation({ summary: 'List voucher campaigns' })
  list() {
    return this.vouchersService.adminList();
  }

  @Post()
  @ApiOperation({ summary: 'Create a voucher campaign' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.adminCreate(dto);
  }
}
