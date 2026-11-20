import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Clock, SystemClock } from '../auth/clock';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';
import { DashboardsController } from './dashboards.controller';
import { ManagerDashboardService } from './manager-dashboard.service';

@Module({
  imports: [AccessModule, TypeOrmModule.forFeature([Employee, LeaveEntry])],
  controllers: [DashboardsController],
  providers: [
    ManagerDashboardService,
    { provide: Clock, useClass: SystemClock },
  ],
})
export class DashboardsModule {}
