import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { Clock, SystemClock } from '../auth/clock';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [AccessModule, TypeOrmModule.forFeature([Employee, LeaveEntry])],
  controllers: [DashboardsController],
  providers: [DashboardsService, { provide: Clock, useClass: SystemClock }],
})
export class DashboardsModule {}
