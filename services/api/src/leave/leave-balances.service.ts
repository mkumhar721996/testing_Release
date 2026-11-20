import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveType } from './leave-type.entity';

@Injectable()
export class LeaveBalancesService {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly balances: Repository<LeaveBalance>,
    @InjectRepository(LeaveType)
    private readonly types: Repository<LeaveType>,
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) {}

  /** One row per leave type; `days` is null when HR has not set it. */
  async list(employeeId: string): Promise<
    Array<{
      leaveTypeId: string;
      name: string;
      exempt: boolean;
      days: number | null;
    }>
  > {
    await this.assertEmployee(employeeId);
    const [types, balances] = await Promise.all([
      this.types.find({ order: { name: 'ASC' } }),
      this.balances.findBy({ employeeId }),
    ]);
    const days = new Map(balances.map((b) => [b.leaveTypeId, b.days]));
    return types.map((t) => ({
      leaveTypeId: t.id,
      name: t.name,
      exempt: t.exempt,
      days: days.get(t.id) ?? null,
    }));
  }

  async set(
    employeeId: string,
    leaveTypeId: string,
    days: number,
  ): Promise<{ leaveTypeId: string; days: number }> {
    if (!Number.isInteger(days) || days < 0) {
      throw new BadRequestException({ code: 'balance_invalid' });
    }
    await this.assertEmployee(employeeId);
    if (!(await this.types.existsBy({ id: leaveTypeId }))) {
      throw new NotFoundException({ code: 'leave_type_not_found' });
    }
    await this.balances.upsert({ employeeId, leaveTypeId, days }, [
      'employeeId',
      'leaveTypeId',
    ]);
    return { leaveTypeId, days };
  }

  private async assertEmployee(id: string) {
    if (!(await this.employees.existsBy({ id }))) {
      throw new NotFoundException({ code: 'employee_not_found' });
    }
  }
}
