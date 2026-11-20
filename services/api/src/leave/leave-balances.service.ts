import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Employee } from '../employees/employee.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveType } from './leave-type.entity';

// Postgres `int` upper bound; larger values would overflow the column.
const MAX_BALANCE_DAYS = 2147483647;

export interface BalanceRow {
  leaveTypeId: string;
  name: string;
  exempt: boolean;
  days: number | null;
}

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LeaveType)
    private readonly types: Repository<LeaveType>,
  ) {}

  async list(employeeId: string): Promise<BalanceRow[]> {
    const employees = this.dataSource.getRepository(Employee);
    if (!(await employees.existsBy({ id: employeeId }))) {
      throw new NotFoundException({ code: 'employee_not_found' });
    }
    const [types, balances] = await Promise.all([
      this.types.find({ order: { name: 'ASC' } }),
      this.dataSource.getRepository(LeaveBalance).findBy({ employeeId }),
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
    actorUserId: string,
  ): Promise<{ leaveTypeId: string; days: number }> {
    if (
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 0 ||
      days > MAX_BALANCE_DAYS
    ) {
      throw new BadRequestException({ code: 'balance_invalid' });
    }
    await this.dataSource.transaction(async (em) => {
      if (!(await em.existsBy(Employee, { id: employeeId }))) {
        throw new NotFoundException({ code: 'employee_not_found' });
      }
      if (!(await em.existsBy(LeaveType, { id: leaveTypeId }))) {
        throw new NotFoundException({ code: 'leave_type_not_found' });
      }
      const previous = await em.findOneBy(LeaveBalance, {
        employeeId,
        leaveTypeId,
      });
      await em.upsert(LeaveBalance, { employeeId, leaveTypeId, days }, [
        'employeeId',
        'leaveTypeId',
      ]);
      const row = await em.findOneByOrFail(LeaveBalance, {
        employeeId,
        leaveTypeId,
      });
      await em.save(AuditEntry, {
        actorUserId,
        entity: 'leave_balance',
        entityId: row.id,
        action: previous ? 'update' : 'create',
        changes: {
          employeeId,
          leaveTypeId,
          days,
          previousDays: previous?.days ?? null,
        },
      });
    });
    return { leaveTypeId, days };
  }
}
