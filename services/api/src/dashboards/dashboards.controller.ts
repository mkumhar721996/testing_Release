import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { Clock } from '../auth/clock';
import { SessionGuard } from '../auth/session.guard';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly clock: Clock,
  ) {}

  @Get()
  @RequirePermission('dashboards:read')
  list() {
    return { dashboards: [] };
  }

  @Get('executive')
  @RequirePermission('dashboards:executive')
  executive() {
    return this.dashboards.executiveSummary(this.clock.now());
  }
}
