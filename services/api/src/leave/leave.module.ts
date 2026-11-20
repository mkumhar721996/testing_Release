import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveController } from './leave.controller';
import { LeaveEntry } from './leave-entry.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesService } from './leave-types.service';

@Module({
  imports: [
    AccessModule,
    TypeOrmModule.forFeature([LeaveEntry, LeaveType, LeaveBalance]),
  ],
  controllers: [
    LeaveController,
    LeaveTypesController,
    LeaveBalancesController,
  ],
  providers: [LeaveTypesService, LeaveBalancesService],
})
export class LeaveModule {}
