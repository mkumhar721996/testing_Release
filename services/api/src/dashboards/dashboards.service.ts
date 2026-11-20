import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock } from '../auth/clock';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';

export interface HrAdminDashboard {
  /** ISO date used for "today". */
  asOf: string;
  /** ISO date, today minus 12 months (inclusive start of the leavers window). */
  leaversSince: string;
  headcount: number;
  leavers12m: number;
  leaveDays: number;
  headcountByDepartment: { department: string; count: number }[];
  leaveByType: { kind: string; days: number }[];
}

/** The same day one year earlier; 29 Feb falls back to 28 Feb. */
export const leaversWindowStart = (today: string): string => {
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${year - 1}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const DEPARTMENT = `COALESCE(e.department, 'Unassigned')`;
const LEAVE_DAYS = 'SUM(l."endDate" - l."startDate" + 1)';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(LeaveEntry)
    private readonly leave: Repository<LeaveEntry>,
    private readonly clock: Clock,
  ) {}

  async hrAdminSummary(): Promise<HrAdminDashboard> {
    const today = this.clock.now().toISOString().slice(0, 10);
    const since = leaversWindowStart(today);

    const departments = await this.employees
      .createQueryBuilder('e')
      .select(DEPARTMENT, 'department')
      .addSelect('COUNT(*)', 'count')
      .where('(e."terminationDate" IS NULL OR e."terminationDate" > :today)', {
        today,
      })
      .groupBy(DEPARTMENT)
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy(DEPARTMENT, 'ASC')
      .getRawMany<{ department: string; count: string }>();

    const leavers12m = await this.employees
      .createQueryBuilder('e')
      .where(
        'e."terminationDate" >= :since AND e."terminationDate" <= :today',
        { since, today },
      )
      .getCount();

    const leave = await this.leave
      .createQueryBuilder('l')
      .select('l.kind', 'kind')
      .addSelect(LEAVE_DAYS, 'days')
      .where('l."startDate" <= :today', { today })
      .groupBy('l.kind')
      .orderBy(LEAVE_DAYS, 'DESC')
      .addOrderBy('l.kind', 'ASC')
      .getRawMany<{ kind: string; days: string }>();

    const headcountByDepartment = departments.map((r) => ({
      department: r.department,
      count: Number(r.count),
    }));
    const leaveByType = leave.map((r) => ({
      kind: r.kind,
      days: Number(r.days),
    }));
    return {
      asOf: today,
      leaversSince: since,
      headcount: sum(headcountByDepartment.map((d) => d.count)),
      leavers12m,
      leaveDays: sum(leaveByType.map((t) => t.days)),
      headcountByDepartment,
      leaveByType,
    };
  }
}
