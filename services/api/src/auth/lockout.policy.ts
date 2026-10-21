import { LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS } from './auth.constants';

export interface LockState {
  failedSignInCount: number;
  lockStartedAt: Date | null;
}

export function isLocked(state: LockState, now: Date): boolean {
  return (
    state.lockStartedAt !== null &&
    now.getTime() < state.lockStartedAt.getTime() + LOCK_DURATION_MS
  );
}

export function afterSuccess(): LockState {
  return { failedSignInCount: 0, lockStartedAt: null };
}

export function afterFailure(state: LockState, now: Date): LockState {
  // An expired lock is a fresh state before the attempt is evaluated.
  const base =
    state.lockStartedAt !== null && !isLocked(state, now)
      ? afterSuccess()
      : state;
  const failedSignInCount = base.failedSignInCount + 1;
  return {
    failedSignInCount,
    lockStartedAt:
      failedSignInCount >= MAX_FAILED_ATTEMPTS ? now : base.lockStartedAt,
  };
}
