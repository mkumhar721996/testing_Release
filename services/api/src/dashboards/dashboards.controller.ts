import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';

@Controller('dashboards')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class DashboardsController {
  @Get()
  @RequirePermission('dashboards:read')
  list() {
    return { dashboards: [] };
  }
}
