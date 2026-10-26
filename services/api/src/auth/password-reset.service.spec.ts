import { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import {
  PasswordPolicyError,
  PasswordResetLinkExpiredError,
  PasswordResetLinkInvalidError,
  SignInRefusedError,
} from './auth.errors';
import { PASSWORD_RESET_TOKEN_TTL_MS } from './auth.constants';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { PasswordResetNotifier } from './password-reset.notifier';
import { PasswordResetService } from './password-reset.service';
import { SessionService } from './session.service';
import {
  FakeClock,
  FakeDataSource,
  FakeRepo,
  statefulCognito,
} from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');
const EMAIL = 'a@example.com';
const OLD = 'old-password';
const NEW = 'new-password-1';

describe('PasswordResetService', () => {
  let clock: FakeClock;
  let cognito: ReturnType<typeof statefulCognito>;
  let users: FakeRepo<User>;
  let tokens: FakeRepo<PasswordResetToken>;
  let notifier: { send: jest.Mock };
  let resets: PasswordResetService;
  let auth: AuthService;

  const addUser = (email: string, status: 'active' | 'pending' = 'active') =>
    users.save({
      email,
      cognitoSub: `sub-${email}`,
      status,
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);

  const requestToken = async () => {
    await resets.request(EMAIL);
    return notifier.send.mock.calls[0][1] as string;
  };

  beforeEach(async () => {
    process.env.SESSION_ENCRYPTION_KEY = 'test-encryption-key';
    clock = new FakeClock(t0);
    cognito = statefulCognito({ [EMAIL]: OLD });
    users = new FakeRepo<User>();
    tokens = new FakeRepo<PasswordResetToken>();
    notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const repos = new Map<unknown, FakeRepo<never>>([
      [User, users as never],
      [PasswordResetToken, tokens as never],
    ]);
    const dataSource = new FakeDataSource(repos) as unknown as DataSource;
    resets = new PasswordResetService(
      tokens as unknown as Repository<PasswordResetToken>,
      users as unknown as Repository<User>,
      dataSource,
      cognito,
      clock,
      notifier as unknown as PasswordResetNotifier,
    );
    auth = new AuthService(
      dataSource,
      new SessionService(
        new FakeRepo<Session>() as unknown as Repository<Session>,
        clock,
      ),
      cognito,
      clock,
    );
    await addUser(EMAIL);
  });

  it('lets the user sign in with the new password after a reset (AC1)', async () => {
    const token = await requestToken();
    await resets.redeem(token, NEW);
    await expect(auth.signIn(EMAIL, NEW)).resolves.toMatchObject({
      user: { email: EMAIL },
    });
    expect(cognito.setPermanentPassword).toHaveBeenCalledWith(EMAIL, NEW);
  });

  it('refuses the previous password after a reset (AC2)', async () => {
    const token = await requestToken();
    await resets.redeem(token, NEW);
    await expect(auth.signIn(EMAIL, OLD)).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
  });

  it('rejects a second redemption of the same token', async () => {
    const token = await requestToken();
    await resets.redeem(token, NEW);
    await expect(resets.redeem(token, NEW)).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    );
  });

  it('rejects an unknown token', async () => {
    await expect(resets.redeem('nope', NEW)).rejects.toBeInstanceOf(
      PasswordResetLinkInvalidError,
    );
  });

  it('rejects an expired token', async () => {
    const token = await requestToken();
    clock.advance(PASSWORD_RESET_TOKEN_TTL_MS);
    await expect(resets.redeem(token, NEW)).rejects.toBeInstanceOf(
      PasswordResetLinkExpiredError,
    );
  });

  it('lets exactly one of two concurrent redemptions through', async () => {
    const token = await requestToken();
    const results = await Promise.allSettled([
      resets.redeem(token, NEW),
      resets.redeem(token, NEW),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(cognito.setPermanentPassword).toHaveBeenCalledTimes(1);
  });

  it('leaves the token unused when the password policy rejects it', async () => {
    const token = await requestToken();
    cognito.setPermanentPassword.mockRejectedValueOnce(
      new PasswordPolicyError(),
    );
    await expect(resets.redeem(token, 'weak')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    expect(tokens.rows[0].usedAt).toBeNull();
  });

  it('stores only a hash of the token', async () => {
    const token = await requestToken();
    expect(tokens.rows[0].tokenHash).not.toContain(token);
  });

  it('does not throw or send anything for an unknown email', async () => {
    await expect(resets.request('nobody@example.com')).resolves.toBeUndefined();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it('matches the email trimmed and case-insensitively', async () => {
    await resets.request('  A@Example.com ');
    expect(notifier.send).toHaveBeenCalledWith(EMAIL, expect.any(String));
  });

  it('issues no token to a pending user', async () => {
    await addUser('pending@example.com', 'pending');
    await resets.request('pending@example.com');
    expect(notifier.send).not.toHaveBeenCalled();
    expect(tokens.rows).toHaveLength(0);
  });

  it('lets a locked-out user sign in with the new password after a reset', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(auth.signIn(EMAIL, 'bad')).rejects.toBeInstanceOf(
        SignInRefusedError,
      );
    }
    await expect(auth.signIn(EMAIL, OLD)).rejects.toBeInstanceOf(
      SignInRefusedError,
    );
    const token = await requestToken();
    await resets.redeem(token, NEW);
    await expect(auth.signIn(EMAIL, NEW)).resolves.toMatchObject({
      user: { email: EMAIL },
    });
  });
});
