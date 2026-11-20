import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { LeaveTypesService } from './leave-types.service';

@Controller('leave-types')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class LeaveTypesController {
  constructor(private readonly leaveTypes: LeaveTypesService) {}

  @Get()
  @RequirePermission('leave:read')
  list() {
    return this.leaveTypes.list();
  }

  @Post()
  @RequirePermission('leave:manage')
  create(@Body() body: { name?: unknown; exempt?: unknown }) {
    return this.leaveTypes.create({ name: body?.name, exempt: body?.exempt });
  }

  @Patch(':id')
  @RequirePermission('leave:manage')
  update(
    @Param('id') id: string,
    @Body() body: { name?: unknown; exempt?: unknown },
  ) {
    return this.leaveTypes.update(id, {
      name: body?.name,
      exempt: body?.exempt,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('leave:manage')
  async remove(@Param('id') id: string) {
    await this.leaveTypes.remove(id);
  }
}
