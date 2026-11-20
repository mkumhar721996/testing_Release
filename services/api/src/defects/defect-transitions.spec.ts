import { Role } from '../auth/role';
import { checkMove, legalMoves } from './defect-transitions';

describe('checkMove', () => {
  const path = [
    'New',
    'Triaged',
    'In Progress',
    'Fixed',
    'Verified',
    'Closed',
  ] as const;
  const moveFor = {
    Triaged: 'triage',
    'In Progress': 'start',
    Fixed: 'fix',
    Verified: 'verify',
    Closed: 'close',
  } as const;
  const roleFor = {
    triage: 'triager',
    start: 'developer',
    fix: 'developer',
    verify: 'qa',
    close: 'qa',
  } as const;

  it.each(path.slice(1).map((to, i) => [path[i], to] as const))(
    'AC1: %s -> %s',
    (from, to) => {
      const move = moveFor[to as keyof typeof moveFor];
      expect(checkMove(from, move, roleFor[move], {})).toEqual({
        ok: true,
        to,
      });
    },
  );

  it('AC2/AC3: refuses skips as illegal_transition', () => {
    expect(checkMove('New', 'start', 'developer', {})).toEqual({
      ok: false,
      code: 'illegal_transition',
    });
    expect(checkMove('Fixed', 'close', 'qa', {})).toEqual({
      ok: false,
      code: 'illegal_transition',
    });
  });

  it('AC4: failed verification returns to In Progress', () => {
    expect(checkMove('Fixed', 'fail_verification', 'qa', {})).toEqual({
      ok: true,
      to: 'In Progress',
    });
  });

  it('AC5/AC6: reject and duplicate carry their extra information', () => {
    expect(
      checkMove('Triaged', 'reject', 'triager', { reason: 'Works as designed' }),
    ).toEqual({ ok: true, to: 'Rejected' });
    expect(
      checkMove('New', 'duplicate', 'triager', { originalKey: 'DEF-0988' }),
    ).toEqual({ ok: true, to: 'Duplicate' });
  });

  it('AC7: duplicate without the original is refused', () => {
    expect(checkMove('New', 'duplicate', 'triager', {})).toEqual({
      ok: false,
      code: 'original_required',
    });
    expect(
      checkMove('New', 'duplicate', 'triager', { originalKey: '  ' }),
    ).toEqual({ ok: false, code: 'original_required' });
  });

  it('AC8: reject without a reason is refused', () => {
    expect(checkMove('Triaged', 'reject', 'triager', {})).toEqual({
      ok: false,
      code: 'reason_required',
    });
    expect(
      checkMove('Triaged', 'reject', 'triager', { reason: '   ' }),
    ).toEqual({ ok: false, code: 'reason_required' });
  });

  it('AC9/AC10: reopen needs a reason', () => {
    expect(
      checkMove('Closed', 'reopen', 'qa', { reason: 'Seen again in build 4' }),
    ).toEqual({ ok: true, to: 'In Progress' });
    expect(checkMove('Closed', 'reopen', 'qa', {})).toEqual({
      ok: false,
      code: 'reason_required',
    });
  });

  it('AC11: rejection is not offered once work has started', () => {
    expect(
      checkMove('In Progress', 'reject', 'triager', { reason: 'x' }),
    ).toEqual({ ok: false, code: 'illegal_transition' });
  });

  it.each([
    'developer',
    'triager',
    'employee',
    'manager',
    'hr_admin',
    'read_only_executive',
  ] as Role[])('AC12-14: %s cannot verify, close or reopen', (role) => {
    expect(checkMove('Fixed', 'verify', role, {})).toEqual({
      ok: false,
      code: 'forbidden',
    });
    expect(checkMove('Verified', 'close', role, {})).toEqual({
      ok: false,
      code: 'forbidden',
    });
    expect(checkMove('Closed', 'reopen', role, { reason: 'r' })).toEqual({
      ok: false,
      code: 'forbidden',
    });
    expect(checkMove('Fixed', 'fail_verification', role, {})).toEqual({
      ok: false,
      code: 'forbidden',
    });
  });

  it('AC15/AC16: triager and developer make their own moves', () => {
    expect(checkMove('New', 'triage', 'triager', {})).toEqual({
      ok: true,
      to: 'Triaged',
    });
    expect(checkMove('In Progress', 'fix', 'developer', {})).toEqual({
      ok: true,
      to: 'Fixed',
    });
    expect(checkMove('New', 'triage', 'developer', {})).toEqual({
      ok: true,
      to: 'Triaged',
    });
    expect(checkMove('Triaged', 'start', 'triager', {})).toEqual({
      ok: true,
      to: 'In Progress',
    });
    expect(checkMove('In Progress', 'fix', 'triager', {})).toEqual({
      ok: false,
      code: 'forbidden',
    });
  });

  it('treats Rejected and Duplicate as final', () => {
    expect(legalMoves('Rejected')).toEqual([]);
    expect(legalMoves('Duplicate')).toEqual([]);
    expect(legalMoves('Fixed')).toEqual(['verify', 'fail_verification']);
  });
});
