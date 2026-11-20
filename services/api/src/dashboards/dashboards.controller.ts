import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ManagerDashboardService } from './manager-dashboard.service';

@Controller('dashboards')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class DashboardsController {
  constructor(private readonly managerDashboard: ManagerDashboardService) {}

  @Get()
  @RequirePermission('dashboards:read')
  list() {
    return { dashboards: [] };
  }

  @Get('manager')
  @RequirePermission('dashboards:team')
  manager(@Req() req: { actor: Actor }) {
    return this.managerDashboard.forActor(req.actor);
  }
}
