import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';

export interface ExecutiveSummary {
  headcount: number;
  leaveDaysTaken: number;
  leaveYear: { from: string; to: string };
  hasData: boolean;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(LeaveEntry)
    private readonly leave: Repository<LeaveEntry>,
  ) {}

  /** Company-wide counts only: no names, pay or ids ever leave the database. */
  async executiveSummary(today: Date): Promise<ExecutiveSummary> {
    const to = isoDate(today);
    const from = `${to.slice(0, 4)}-01-01`;
    const headcount = await this.employees.count();
    // Calendar days inclusive, each entry clipped to [1 Jan, today].
    const row = await this.leave
      .createQueryBuilder('l')
      .select(
        'COALESCE(SUM(LEAST(l."endDate", :today::date) - GREATEST(l."startDate", :yearStart::date) + 1), 0)',
        'days',
      )
      .addSelect('COUNT(*)', 'entries')
      .where(
        'l."startDate" <= :today::date AND l."endDate" >= :yearStart::date',
      )
      .setParameters({ yearStart: from, today: to })
      .getRawOne<{ days: string | null; entries: string }>();
    const leaveDaysTaken = Number(row?.days ?? 0);
    const entries = Number(row?.entries ?? 0);
    return {
      headcount,
      leaveDaysTaken,
      leaveYear: { from, to },
      hasData: headcount > 0 || leaveDaysTaken > 0 || entries > 0,
    };
  }
}
