import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { UsersAdminService } from './users-admin.service';

@Controller('admin/users')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class UsersAdminController {
  constructor(private readonly admin: UsersAdminService) {}

  @Get()
  @RequirePermission('admin:view')
  list() {
    return this.admin.list();
  }

  @Post('invite')
  @RequirePermission('admin:view')
  invite(
    @Body() body: { email?: unknown; displayName?: unknown; role?: unknown },
  ) {
    return this.admin.invite({
      email: body?.email,
      displayName: body?.displayName,
      role: body?.role,
    });
  }

  @Patch(':id/role')
  @RequirePermission('admin:view')
  changeRole(@Param('id') id: string, @Body() body: { role?: unknown }) {
    return this.admin.changeRole(id, body?.role);
  }

  @Post(':id/deactivate')
  @RequirePermission('admin:view')
  deactivate(@Param('id') id: string) {
    return this.admin.deactivate(id);
  }

  @Post(':id/reactivate')
  @RequirePermission('admin:view')
  reactivate(@Param('id') id: string) {
    return this.admin.reactivate(id);
  }
}
