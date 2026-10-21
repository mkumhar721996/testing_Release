import {
  afterFailure,
  afterSuccess,
  isLocked,
  LockState,
} from './lockout.policy';

const t0 = new Date('2026-01-01T00:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('lockout policy', () => {
  it('counts failures without locking before the 5th', () => {
    let s: LockState = afterSuccess();
    for (let i = 0; i < 4; i++) s = afterFailure(s, t0);
    expect(s).toEqual({ failedSignInCount: 4, lockStartedAt: null });
    expect(isLocked(s, t0)).toBe(false);
  });

  it('starts the lock on the 5th failure', () => {
    const s = afterFailure({ failedSignInCount: 4, lockStartedAt: null }, t0);
    expect(s.failedSignInCount).toBe(5);
    expect(s.lockStartedAt).toEqual(t0);
    expect(isLocked(s, t0)).toBe(true);
  });

  it('is locked until exactly 15 minutes after the lock began', () => {
    const s = { failedSignInCount: 5, lockStartedAt: t0 };
    expect(isLocked(s, at(900_000 - 1))).toBe(true);
    expect(isLocked(s, at(900_000))).toBe(false);
  });

  it('treats an expired lock as a fresh state on the next failure', () => {
    const s = afterFailure(
      { failedSignInCount: 5, lockStartedAt: t0 },
      at(900_000),
    );
    expect(s).toEqual({ failedSignInCount: 1, lockStartedAt: null });
  });

  it('resets on success', () => {
    expect(afterSuccess()).toEqual({
      failedSignInCount: 0,
      lockStartedAt: null,
    });
  });
});
