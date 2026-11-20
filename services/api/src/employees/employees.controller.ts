import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { EmployeeInput } from './employee-input';
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

  @Get()
  @RequirePermission('employees:search')
  list(@Query('q') q?: string) {
    return this.employees.search(typeof q === 'string' ? q : '');
  }

  @Get('options')
  @RequirePermission('employees:search')
  options() {
    return this.employees.options();
  }

  @Post()
  @RequirePermission('employees:create')
  create(@Req() req: { actor: Actor }, @Body() body: Partial<EmployeeInput>) {
    return this.employees.create(body, req.actor.id);
  }

  @Get(':id')
  @RequirePermission('record:read')
  get(@Param('id') id: string) {
    return this.employees.findById(id);
  }

  @Patch(':id')
  @RequirePermission('record:write')
  async update(
    @Req() req: { actor: Actor },
    @Param('id') id: string,
    @Body() body: Partial<EmployeeInput>,
  ) {
    const updated = await this.employees.update(id, body, req.actor.id);
    if (!updated) throw new NotFoundException({ code: 'not_found' });
    return updated;
  }
}
