import { DataSource, Repository } from 'typeorm';
import {
  PasswordPolicyError,
  PasswordResetLinkExpiredError,
  PasswordResetLinkInvalidError,
} from './auth.errors';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { User } from './entities/user.entity';
import { PasswordResetService } from './password-reset.service';
import {
  FakeClock,
  FakeDataSource,
  FakeRepo,
  fakeCognito,
  fakeNotifier,
} from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');
const PASSWORD = 'test-password';
const HOUR = 60 * 60_000;

describe('PasswordResetService', () => {
  let clock: FakeClock;
  let cognito: ReturnType<typeof fakeCognito>;
  let notifier: ReturnType<typeof fakeNotifier>;
  let users: FakeRepo<User>;
  let tokens: FakeRepo<PasswordResetToken>;
  let reset: PasswordResetService;

  const makeUser = (email: string, status: 'active' | 'pending' = 'active') =>
    users.save({
      email,
      cognitoSub: `sub-${email}`,
      status,
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);

  const requestToken = async (email = 'a@example.com') => {
    await reset.request(email);
    return notifier.notify.mock.calls[0][1];
  };

  beforeEach(() => {
    clock = new FakeClock(t0);
    cognito = fakeCognito();
    notifier = fakeNotifier();
    users = new FakeRepo<User>();
    tokens = new FakeRepo<PasswordResetToken>();
    const repos = new Map<unknown, FakeRepo<never>>([
      [User, users as never],
      [PasswordResetToken, tokens as never],
    ]);
    reset = new PasswordResetService(
      users as unknown as Repository<User>,
      tokens as unknown as Repository<PasswordResetToken>,
      new FakeDataSource(repos) as unknown as DataSource,
      cognito,
      notifier,
      clock,
    );
  });

  it('lets a user who forgot their password set a new one (AC1)', async () => {
    await makeUser('a@example.com');
    await reset.request('A@Example.com ');
    expect(notifier.notify.mock.calls[0][0]).toBe('a@example.com');
    const token = notifier.notify.mock.calls[0][1];
    await reset.redeem(token, 'new-password');
    expect(cognito.setPermanentPassword).toHaveBeenCalledWith(
      'a@example.com',
      'new-password',
    );
    expect(cognito.enableUser).not.toHaveBeenCalled();
    expect(tokens.rows[0].usedAt).not.toBeNull();
  });

  it('stores only a hash of the token', async () => {
    await makeUser('a@example.com');
    const token = await requestToken();
    expect(tokens.rows[0].tokenHash).not.toContain(token);
  });

  it('rejects a second redemption of the same link', async () => {
    await makeUser('a@example.com');
    const token = await requestToken();
    await reset.redeem(token, PASSWORD);
    await expect(reset.redeem(token, PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    );
  });

  it('rejects an unknown token', async () => {
    await expect(reset.redeem('nope', PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    );
  });

  it('refuses an expired link without touching Cognito', async () => {
    await makeUser('a@example.com');
    const token = await requestToken();
    clock.advance(HOUR + 1);
    await expect(reset.redeem(token, PASSWORD)).rejects.toBeInstanceOf(
      PasswordResetLinkExpiredError,
    );
    expect(cognito.setPermanentPassword).not.toHaveBeenCalled();
  });

  it('keeps the link usable when Cognito refuses the password', async () => {
    await makeUser('a@example.com');
    const token = await requestToken();
    cognito.setPermanentPassword.mockRejectedValueOnce(
      new PasswordPolicyError(),
    );
    await expect(reset.redeem(token, 'weak')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    expect(tokens.rows[0].usedAt).toBeNull();
    await expect(reset.redeem(token, PASSWORD)).resolves.toBeUndefined();
  });

  it('lets only one of two concurrent redemptions through', async () => {
    await makeUser('a@example.com');
    const token = await requestToken();
    const results = await Promise.allSettled([
      reset.redeem(token, PASSWORD),
      reset.redeem(token, PASSWORD),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(cognito.setPermanentPassword).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unknown', undefined],
    ['pending', 'pending' as const],
  ])('issues no token for an %s account and does not throw', async (_l, s) => {
    if (s) await makeUser('a@example.com', s);
    await expect(reset.request('a@example.com')).resolves.toBeUndefined();
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(tokens.rows).toHaveLength(0);
  });

  it('unlocks a locked account after reset', async () => {
    const user = await makeUser('a@example.com');
    await users.save({
      ...user,
      failedSignInCount: 5,
      lockStartedAt: t0,
    });
    const token = await requestToken();
    await reset.redeem(token, PASSWORD);
    const after = await users.findOneByOrFail({ id: user.id });
    expect(after.failedSignInCount).toBe(0);
    expect(after.lockStartedAt).toBeNull();
  });
});
