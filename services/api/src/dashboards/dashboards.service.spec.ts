import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { LeaveEntry } from '../leave/leave-entry.entity';
import { DashboardsService } from './dashboards.service';

const today = new Date('2026-11-20T10:00:00Z');

function build(headcount: number, row: { days: string | null; entries: string }) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(row),
  };
  const employees = { count: jest.fn().mockResolvedValue(headcount) };
  const leave = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const service = new DashboardsService(
    employees as unknown as Repository<Employee>,
    leave as unknown as Repository<LeaveEntry>,
  );
  return { service, qb };
}

describe('DashboardsService.executiveSummary', () => {
  it('returns headcount and leave days taken (AC1, AC2)', async () => {
    const { service, qb } = build(3, { days: '7', entries: '2' });
    expect(await service.executiveSummary(today)).toEqual({
      headcount: 3,
      leaveDaysTaken: 7,
      leaveYear: { from: '2026-01-01', to: '2026-11-20' },
      hasData: true,
    });
    expect(qb.setParameters).toHaveBeenCalledWith({
      yearStart: '2026-01-01',
      today: '2026-11-20',
    });
  });

  it('reports no data when there are no employees or leave (AC8, AC9)', async () => {
    const { service } = build(0, { days: null, entries: '0' });
    expect(await service.executiveSummary(today)).toEqual({
      headcount: 0,
      leaveDaysTaken: 0,
      leaveYear: { from: '2026-01-01', to: '2026-11-20' },
      hasData: false,
    });
  });

  it('has data when only leave exists', async () => {
    const { service } = build(0, { days: '2', entries: '1' });
    expect((await service.executiveSummary(today)).hasData).toBe(true);
  });
});
