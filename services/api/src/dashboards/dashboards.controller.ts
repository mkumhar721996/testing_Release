import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { DashboardsService, HrAdminDashboard } from './dashboards.service';

@Controller('dashboards')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  @RequirePermission('dashboards:read')
  list() {
    return { dashboards: [] };
  }

  @Get('hr-admin')
  @RequirePermission('dashboards:hr-admin')
  hrAdmin(): Promise<HrAdminDashboard> {
    return this.dashboards.hrAdminSummary();
  }
}
