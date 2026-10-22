import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(SessionGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query('q') q?: string, @Query('status') status?: string) {
    return this.employees.list(q, status);
  }
}
