import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { LeaveTypeInput, LeaveTypesService } from './leave-types.service';

@Controller('leave-types')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class LeaveTypesController {
  constructor(private readonly service: LeaveTypesService) {}

  @Get()
  @RequirePermission('leave:read')
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission('leave:manage')
  create(@Body() body: LeaveTypeInput, @Req() req: { actor: Actor }) {
    return this.service.create(body ?? {}, req.actor.id);
  }

  @Patch(':id')
  @RequirePermission('leave:manage')
  update(
    @Param('id') id: string,
    @Body() body: LeaveTypeInput,
    @Req() req: { actor: Actor },
  ) {
    return this.service.update(id, body ?? {}, req.actor.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('leave:manage')
  remove(@Param('id') id: string, @Req() req: { actor: Actor }) {
    return this.service.remove(id, req.actor.id);
  }
}
