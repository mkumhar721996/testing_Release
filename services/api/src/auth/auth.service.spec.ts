import { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { InvalidCredentialsError, SignInRefusedError } from './auth.errors';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { SessionService } from './session.service';
import {
  FakeClock,
  FakeDataSource,
  FakeRepo,
  fakeCognito,
} from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');
const MIN = 60_000;

describe('AuthService', () => {
  let clock: FakeClock;
  let cognito: ReturnType<typeof fakeCognito>;
  let users: FakeRepo<User>;
  let sessions: SessionService;
  let auth: AuthService;
  let user: User;
  const stored = () => users.findOneByOrFail({ id: user.id });

  const fail = async (n: number) => {
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    for (let i = 0; i < n; i++) {
      await expect(auth.signIn(user.email, 'bad')).rejects.toBeInstanceOf(
        SignInRefusedError,
      );
    }
  };
  const succeed = () =>
    cognito.signIn.mockResolvedValue({
      refreshToken: 'r',
      sub: user.cognitoSub,
    });

  beforeEach(async () => {
    process.env.SESSION_ENCRYPTION_KEY = 'test-encryption-key';
    clock = new FakeClock(t0);
    cognito = fakeCognito();
    users = new FakeRepo<User>();
    sessions = new SessionService(
      new FakeRepo<Session>() as unknown as Repository<Session>,
      clock,
    );
    auth = new AuthService(
      new FakeDataSource(
        new Map([[User, users as never]]),
      ) as unknown as DataSource,
      sessions,
      cognito,
      clock,
    );
    user = await users.save({
      email: 'ada@example.com',
      cognitoSub: 'sub-1',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);
  });

  it('refuses a deactivated account without consulting Cognito (AC10)', async () => {
    succeed();
    await users.save({ ...(await stored()), status: 'deactivated' });
    await expect(auth.signIn(user.email, 'test-password')).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
    expect(cognito.signIn).not.toHaveBeenCalled();
  });

  it('signs in with valid credentials (AC3, AC8)', async () => {
    succeed();
    const res = await auth.signIn('Ada@Example.com', 'test-password');
    expect(res.user).toEqual({ id: user.id, email: user.email });
    expect(await sessions.touchIfActive(res.sessionId)).not.toBeNull();
    expect(res).not.toHaveProperty('challenge');
  });

  it('signs out by ending the session and revoking the refresh token (AC4)', async () => {
    succeed();
    const res = await auth.signIn(user.email, 'test-password');
    await auth.signOut(res.sessionId);
    expect(await sessions.touchIfActive(res.sessionId)).toBeNull();
    expect(cognito.signOut).toHaveBeenCalledWith('r');
  });

  it('refuses a wrong password and counts it (AC6)', async () => {
    await fail(1);
    expect((await stored()).failedSignInCount).toBe(1);
  });

  it('refuses unknown and pending accounts without calling Cognito', async () => {
    await expect(auth.signIn('nobody@example.com', 'x')).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
    await users.update({ id: user.id }, { status: 'pending' });
    await expect(auth.signIn(user.email, 'x')).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
    expect(cognito.signIn).not.toHaveBeenCalled();
    expect((await stored()).failedSignInCount).toBe(0);
  });

  it('succeeds after 4 consecutive failures and resets the count (AC11)', async () => {
    await fail(4);
    succeed();
    await expect(auth.signIn(user.email, 'right')).resolves.toBeDefined();
    expect((await stored()).failedSignInCount).toBe(0);
  });

  it('refuses the correct password after 5 failures (AC12)', async () => {
    await fail(5);
    succeed();
    await expect(auth.signIn(user.email, 'right')).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
  });

  it('refuses before reaching Cognito until 15 minutes after the lock began (AC13)', async () => {
    await fail(5);
    succeed();
    cognito.signIn.mockClear();
    clock.set(t0.getTime() + 15 * MIN - 1);
    await expect(auth.signIn(user.email, 'right')).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
    expect(cognito.signIn).not.toHaveBeenCalled();
  });

  it('lets the correct password in exactly 15 minutes after the lock began (AC14)', async () => {
    await fail(5);
    succeed();
    clock.set(t0.getTime() + 15 * MIN);
    await expect(auth.signIn(user.email, 'right')).resolves.toBeDefined();
    expect((await stored()).lockStartedAt).toBeNull();
    expect((await stored()).failedSignInCount).toBe(0);
  });

  it('does not extend the lock with attempts made while locked', async () => {
    await fail(5);
    clock.set(t0.getTime() + 10 * MIN);
    await fail(1);
    succeed();
    clock.set(t0.getTime() + 15 * MIN);
    await expect(auth.signIn(user.email, 'right')).resolves.toBeDefined();
  });

  it('cannot be brute-forced with parallel guesses', async () => {
    cognito.signIn.mockRejectedValue(new InvalidCredentialsError());
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => auth.signIn(user.email, 'bad')),
    );
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(cognito.signIn).toHaveBeenCalledTimes(5);
    expect((await stored()).lockStartedAt).toEqual(t0);
  });

  it('does not count Cognito outages as failed passwords', async () => {
    cognito.signIn.mockRejectedValue(new Error('network down'));
    await expect(auth.signIn(user.email, 'right')).rejects.toThrow(
      'network down',
    );
    expect((await stored()).failedSignInCount).toBe(0);
  });
});
