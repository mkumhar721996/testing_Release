import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get('me')
  async me(@Req() req: { actor: Actor }) {
    if (!req.actor.employeeId) {
      throw new ForbiddenException({ code: 'forbidden' });
    }
    return this.employees.findById(req.actor.employeeId);
  }

  @Get(':id')
  @RequirePermission('record:read')
  get(@Param('id') id: string) {
    return this.employees.findById(id);
  }

  @Patch(':id')
  @RequirePermission('record:write')
  update(@Param('id') id: string, @Body() body: { displayName?: unknown }) {
    if (typeof body?.displayName !== 'string' || !body.displayName.trim()) {
      throw new BadRequestException({ code: 'display_name_invalid' });
    }
    return this.employees.rename(id, body.displayName.trim());
  }
}
