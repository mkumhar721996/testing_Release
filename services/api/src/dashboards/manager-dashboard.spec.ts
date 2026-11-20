import {
  buildManagerDashboard,
  LeaveRow,
  PersonRow,
} from './manager-dashboard';

const today = '2026-11-20';
const person = (
  id: string,
  name: string,
  managerId: string | null,
): PersonRow => ({
  id,
  displayName: name,
  managerId,
  jobTitle: 'Engineer',
});
const leave = (
  id: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  status: LeaveRow['status'] = 'approved',
): LeaveRow => ({ id, employeeId, startDate, endDate, kind: 'annual', status });

const people = [
  person('m', 'Maria', null),
  person('r1', 'Ana', 'm'),
  person('x', 'Stranger', 'other'),
];
const run = (viewerId: string, ppl: PersonRow[], l: LeaveRow[]) =>
  buildManagerDashboard({ viewerId, today, people: ppl, leave: l });

describe('buildManagerDashboard', () => {
  it('lists a report off on every covered day (AC1)', () => {
    const d = run('m', people, [leave('l', 'r1', '2026-11-25', '2026-11-27')]);
    expect(d.offDays.map((x) => x.date)).toEqual([
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ]);
    expect(d.offDays[0].people).toEqual([
      { employeeId: 'r1', displayName: 'Ana', kind: 'annual' },
    ]);
  });

  it('includes weekends and clips leave that started before today (AC1)', () => {
    const w = run('m', people, [leave('l', 'r1', '2026-11-27', '2026-11-30')]);
    expect(w.offDays.map((x) => x.date)).toEqual([
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
    ]);
    const p = run('m', people, [leave('l', 'r1', '2026-11-18', '2026-11-21')]);
    expect(p.offDays.map((x) => x.date)).toEqual(['2026-11-20', '2026-11-21']);
    expect(p.offTodayCount).toBe(1);
  });

  it('lists pending requests of direct reports (AC2)', () => {
    const d = run('m', people, [
      leave('l', 'r1', '2026-11-25', '2026-11-27', 'pending'),
    ]);
    expect(d.pending).toHaveLength(1);
    expect(d.pending[0]).toMatchObject({
      employeeId: 'r1',
      awaiting: { employeeId: 'm' },
      coveringFor: null,
      days: 3,
    });
    expect(d.offDays).toEqual([]);
  });

  it('never shows someone who does not report to the viewer (AC3)', () => {
    const d = run('m', people, [
      leave('l', 'x', '2026-11-25', '2026-11-27'),
      leave('p', 'x', '2026-11-25', '2026-11-27', 'pending'),
    ]);
    expect(JSON.stringify(d)).not.toContain('Stranger');
    expect(d.directReportCount).toBe(1);
  });

  it('applies the 30-day window inclusively (AC5)', () => {
    const d = run('m', people, [
      leave('a', 'r1', '2026-12-21', '2026-12-21'),
      leave('b', 'r1', '2026-12-20', '2026-12-20'),
    ]);
    expect(d.offDays.map((x) => x.date)).toEqual(['2026-12-20']);
    expect(d.offTodayCount).toBe(0);
  });

  it.each([['m2'], [null]])(
    'drops a report reassigned or removed (AC6, AC7): %s',
    (managerId) => {
      const d = run(
        'm',
        [person('m', 'Maria', null), person('r1', 'Ana', managerId)],
        [
          leave('a', 'r1', '2026-11-25', '2026-11-27'),
          leave('b', 'r1', '2026-11-25', '2026-11-27', 'pending'),
        ],
      );
      expect(d.directReportCount).toBe(0);
      expect(d.offDays).toEqual([]);
      expect(d.pending).toEqual([]);
    },
  );

  describe('absent manager', () => {
    const ppl = [
      person('V', 'Vera', null),
      person('A', 'Priya', 'V'),
      person('R', 'Rob', 'A'),
    ];
    const l = [
      leave('abs', 'A', '2026-11-18', '2026-11-22'),
      leave('req', 'R', '2026-12-01', '2026-12-02', 'pending'),
    ];

    it("goes to the absent manager's manager (AC8)", () => {
      const d = run('V', ppl, l);
      expect(d.pending).toHaveLength(1);
      expect(d.pending[0]).toMatchObject({
        employeeId: 'R',
        awaiting: { employeeId: 'A' },
        coveringFor: 'Priya',
      });
    });

    it('is hidden from the absent manager (AC9)', () => {
      const d = run('A', ppl, l);
      expect(d.pending).toEqual([]);
      expect(d.viewer).toMatchObject({
        absent: true,
        absentFrom: '2026-11-18',
        absentTo: '2026-11-22',
      });
    });

    it('goes to the manager when not absent today', () => {
      const d = run('A', ppl, [l[1]]);
      expect(d.pending[0].coveringFor).toBeNull();
      expect(d.viewer.absent).toBe(false);
    });
  });
});
