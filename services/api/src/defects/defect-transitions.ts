import { Role } from '../auth/role';

export const DEFECT_STATUSES = [
  'New',
  'Triaged',
  'In Progress',
  'Fixed',
  'Verified',
  'Closed',
  'Rejected',
  'Duplicate',
] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const DEFECT_MOVES = [
  'triage',
  'start',
  'fix',
  'verify',
  'close',
  'reject',
  'duplicate',
  'fail_verification',
  'reopen',
] as const;
export type DefectMove = (typeof DEFECT_MOVES)[number];

export interface MoveInput {
  reason?: string;
  originalKey?: string;
}

export type MoveCheck =
  | { ok: true; to: DefectStatus }
  | {
      ok: false;
      code:
        | 'illegal_transition'
        | 'forbidden'
        | 'reason_required'
        | 'original_required';
    };

const TARGET: Record<DefectMove, DefectStatus> = {
  triage: 'Triaged',
  start: 'In Progress',
  fix: 'Fixed',
  verify: 'Verified',
  close: 'Closed',
  reject: 'Rejected',
  duplicate: 'Duplicate',
  fail_verification: 'In Progress',
  reopen: 'In Progress',
};

const ALLOWED: Record<DefectStatus, DefectMove[]> = {
  New: ['triage', 'reject', 'duplicate'],
  Triaged: ['start', 'reject', 'duplicate'],
  'In Progress': ['fix'],
  Fixed: ['verify', 'fail_verification'],
  Verified: ['close'],
  Closed: ['reopen'],
  Rejected: [],
  Duplicate: [],
};

/** Only QA verifies, closes or reopens; only developers mark Fixed. */
const ROLES_FOR: Record<DefectMove, Role[]> = {
  triage: ['triager', 'developer'],
  start: ['triager', 'developer'],
  fix: ['developer'],
  verify: ['qa'],
  close: ['qa'],
  reject: ['triager', 'developer'],
  duplicate: ['triager', 'developer'],
  fail_verification: ['qa'],
  reopen: ['qa'],
};

const blank = (value?: string) => !value || value.trim() === '';

export function legalMoves(from: DefectStatus): DefectMove[] {
  return [...ALLOWED[from]];
}

/** Legality first, then role, then required fields. */
export function checkMove(
  from: DefectStatus,
  move: DefectMove,
  role: Role,
  input: MoveInput,
): MoveCheck {
  if (!ALLOWED[from].includes(move)) {
    return { ok: false, code: 'illegal_transition' };
  }
  if (!ROLES_FOR[move].includes(role)) {
    return { ok: false, code: 'forbidden' };
  }
  if ((move === 'reject' || move === 'reopen') && blank(input.reason)) {
    return { ok: false, code: 'reason_required' };
  }
  if (move === 'duplicate' && blank(input.originalKey)) {
    return { ok: false, code: 'original_required' };
  }
  return { ok: true, to: TARGET[move] };
}
