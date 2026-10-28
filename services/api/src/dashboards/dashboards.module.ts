import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DashboardsController } from './dashboards.controller';

@Module({
  imports: [AccessModule],
  controllers: [DashboardsController],
})
export class DashboardsModule {}
