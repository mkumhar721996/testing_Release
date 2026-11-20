import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Actor } from '../access/permissions';
import { Clock } from '../auth/clock';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';
import {
  buildManagerDashboard,
  ManagerDashboard,
  PersonRow,
} from './manager-dashboard';

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

@Injectable()
export class ManagerDashboardService {
  constructor(
    private readonly clock: Clock,
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(LeaveEntry)
    private readonly leave: Repository<LeaveEntry>,
  ) {}

  async forActor(actor: Actor): Promise<ManagerDashboard> {
    const viewerId = actor.employeeId as string;
    const now = this.clock.now();
    const today = now.toISOString().slice(0, 10);
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY_MS)
      .toISOString()
      .slice(0, 10);

    const viewer = await this.employees.findOneByOrFail({ id: viewerId });
    const reports = await this.employees.findBy({ managerId: viewerId });
    // Reports' reports: their requests move up to the viewer when they are absent.
    const second = reports.length
      ? await this.employees.findBy({
          managerId: In(reports.map((r) => r.id)),
        })
      : [];
    const everyone = [viewer, ...reports, ...second];
    const people: PersonRow[] = everyone.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      managerId: e.managerId,
      jobTitle: e.jobTitle,
    }));

    // Overlapping the window, covering today, or still awaiting approval.
    const leave = await this.leave
      .createQueryBuilder('l')
      .where('l.employeeId IN (:...ids)', { ids: people.map((p) => p.id) })
      .andWhere(
        "(l.status = 'pending' OR (l.status = 'approved' AND l.startDate <= :windowEnd AND l.endDate >= :today))",
        { today, windowEnd },
      )
      .getMany();

    return buildManagerDashboard({
      viewerId,
      today,
      people,
      leave: leave.map((l) => ({
        id: l.id,
        employeeId: l.employeeId,
        startDate: l.startDate,
        endDate: l.endDate,
        kind: l.kind,
        status: l.status,
      })),
    });
  }
}
