import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { LeaveEntry } from './leave-entry.entity';

@Controller('leave')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class LeaveController {
  constructor(
    @InjectRepository(LeaveEntry)
    private readonly leave: Repository<LeaveEntry>,
  ) {}

  @Get('me')
  @RequirePermission('leave:read')
  async me(@Req() req: { actor: Actor }) {
    const { employeeId } = req.actor;
    const entries = employeeId ? await this.leave.findBy({ employeeId }) : [];
    return { entries };
  }
}
