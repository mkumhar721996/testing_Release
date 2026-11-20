import type { LeaveStatus } from '../leave/leave-entry.entity';

export interface PersonRow {
  id: string;
  displayName: string;
  managerId: string | null;
  jobTitle: string | null;
}

export interface LeaveRow {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  kind: string;
  status: LeaveStatus;
}

export interface ManagerDashboard {
  today: string;
  windowEnd: string;
  viewer: {
    displayName: string;
    jobTitle: string | null;
    absent: boolean;
    absentFrom: string | null;
    absentTo: string | null;
  };
  directReportCount: number;
  offTodayCount: number;
  offDays: {
    date: string;
    people: { employeeId: string; displayName: string; kind: string }[];
  }[];
  pending: {
    id: string;
    employeeId: string;
    employeeName: string;
    kind: string;
    startDate: string;
    endDate: string;
    days: number;
    awaiting: { employeeId: string; displayName: string };
    coveringFor: string | null;
  }[];
}

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildManagerDashboard(input: {
  viewerId: string;
  today: string;
  people: PersonRow[];
  leave: LeaveRow[];
}): ManagerDashboard {
  const { viewerId, today, people, leave } = input;
  const byId = new Map(people.map((p) => [p.id, p]));
  const viewer = byId.get(viewerId);
  const windowEnd = toDate(toMs(today) + WINDOW_DAYS * DAY_MS);
  const approved = leave.filter((l) => l.status === 'approved');

  const absence = (id: string) =>
    approved.find(
      (l) => l.employeeId === id && l.startDate <= today && l.endDate >= today,
    );

  const reports = people.filter((p) => p.managerId === viewerId);
  const reportIds = new Set(reports.map((p) => p.id));

  const offByDate = new Map<
    string,
    ManagerDashboard['offDays'][number]['people']
  >();
  for (const entry of approved) {
    if (!reportIds.has(entry.employeeId)) continue;
    const name = byId.get(entry.employeeId)!.displayName;
    const from = Math.max(toMs(entry.startDate), toMs(today));
    const to = Math.min(toMs(entry.endDate), toMs(windowEnd));
    for (let ms = from; ms <= to; ms += DAY_MS) {
      const date = toDate(ms);
      const list = offByDate.get(date) ?? [];
      list.push({
        employeeId: entry.employeeId,
        displayName: name,
        kind: entry.kind,
      });
      offByDate.set(date, list);
    }
  }
  const offDays = [...offByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      people: list.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }));

  const viewerAbsence = absence(viewerId);

  const pending: ManagerDashboard['pending'] = [];
  if (!viewerAbsence) {
    for (const entry of leave) {
      if (entry.status !== 'pending') continue;
      const requester = byId.get(entry.employeeId);
      const manager = requester?.managerId
        ? byId.get(requester.managerId)
        : undefined;
      if (!requester || !manager) continue;
      const movedUp = absence(manager.id) !== undefined;
      const approverId = movedUp ? manager.managerId : manager.id;
      if (approverId !== viewerId) continue;
      pending.push({
        id: entry.id,
        employeeId: requester.id,
        employeeName: requester.displayName,
        kind: entry.kind,
        startDate: entry.startDate,
        endDate: entry.endDate,
        days: (toMs(entry.endDate) - toMs(entry.startDate)) / DAY_MS + 1,
        awaiting: { employeeId: manager.id, displayName: manager.displayName },
        coveringFor: movedUp ? manager.displayName : null,
      });
    }
    pending.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  return {
    today,
    windowEnd,
    viewer: {
      displayName: viewer?.displayName ?? '',
      jobTitle: viewer?.jobTitle ?? null,
      absent: viewerAbsence !== undefined,
      absentFrom: viewerAbsence?.startDate ?? null,
      absentTo: viewerAbsence?.endDate ?? null,
    },
    directReportCount: reports.length,
    offTodayCount: offDays.find((d) => d.date === today)?.people.length ?? 0,
    offDays,
    pending,
  };
}
