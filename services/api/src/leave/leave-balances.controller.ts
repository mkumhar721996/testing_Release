import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { LeaveBalancesService } from './leave-balances.service';

@Controller('employees/:id/leave-balances')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class LeaveBalancesController {
  constructor(private readonly service: LeaveBalancesService) {}

  @Get()
  @RequirePermission('leave:manage')
  list(@Param('id') id: string) {
    return this.service.list(id);
  }

  @Put(':leaveTypeId')
  @RequirePermission('leave:manage')
  set(
    @Param('id') id: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Body() body: { days?: unknown },
    @Req() req: { actor: Actor },
  ) {
    return this.service.set(
      id,
      leaveTypeId,
      body?.days as number,
      req.actor.id,
    );
  }
}
