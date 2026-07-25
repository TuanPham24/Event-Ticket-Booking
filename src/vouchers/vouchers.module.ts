import { Module } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { AdminVouchersController } from './admin-vouchers.controller';

@Module({
  controllers: [AdminVouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
