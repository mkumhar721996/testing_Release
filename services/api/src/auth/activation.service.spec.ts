import { DataSource, Repository } from 'typeorm';
import { ActivationService } from './activation.service';
import {
  ActivationLinkExpiredError,
  ActivationLinkInvalidError,
  PasswordPolicyError,
} from './auth.errors';
import { ActivationToken } from './entities/activation-token.entity';
import { User } from './entities/user.entity';
import {
  FakeClock,
  FakeDataSource,
  FakeRepo,
  fakeCognito,
} from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');
const PASSWORD = 'test-password';
const DAY = 24 * 60 * 60_000;

describe('ActivationService', () => {
  let clock: FakeClock;
  let cognito: ReturnType<typeof fakeCognito>;
  let users: FakeRepo<User>;
  let tokens: FakeRepo<ActivationToken>;
  let activation: ActivationService;

  const pendingUser = (email: string) =>
    users.save({
      email,
      cognitoSub: `sub-${email}`,
      status: 'pending',
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);

  beforeEach(() => {
    clock = new FakeClock(t0);
    cognito = fakeCognito();
    users = new FakeRepo<User>();
    tokens = new FakeRepo<ActivationToken>();
    const repos = new Map<unknown, FakeRepo<never>>([
      [User, users as never],
      [ActivationToken, tokens as never],
    ]);
    activation = new ActivationService(
      tokens as unknown as Repository<ActivationToken>,
      new FakeDataSource(repos) as unknown as DataSource,
      cognito,
      clock,
    );
  });

  it.each([
    ['imported staff', 'staff@example.com'],
    ['HR-invited joiner', 'joiner@example.com'],
  ])(
    'activates an %s through an unused link (AC1, AC2)',
    async (_label, email) => {
      const user = await pendingUser(email);
      const { token } = await activation.issue(user.id);
      await activation.redeem(token, PASSWORD);
      expect((await users.findOneByOrFail({ id: user.id })).status).toBe(
        'active',
      );
      expect(cognito.setPermanentPassword).toHaveBeenCalledWith(
        email,
        PASSWORD,
      );
      expect(cognito.enableUser).toHaveBeenCalledWith(email);
      expect(
        (await tokens.findOneByOrFail({ userId: user.id })).usedAt,
      ).not.toBeNull();
    },
  );

  it('stores only a hash of the token', async () => {
    const user = await pendingUser('a@example.com');
    const { token } = await activation.issue(user.id);
    expect(tokens.rows[0].tokenHash).not.toContain(token);
  });

  it('rejects a second redemption of the same link', async () => {
    const user = await pendingUser('a@example.com');
    const { token } = await activation.issue(user.id);
    await activation.redeem(token, PASSWORD);
    await expect(activation.redeem(token, PASSWORD)).rejects.toBeInstanceOf(
      ActivationLinkInvalidError,
    );
  });

  it('rejects an unknown token', async () => {
    await expect(activation.redeem('nope', PASSWORD)).rejects.toBeInstanceOf(
      ActivationLinkInvalidError,
    );
  });

  it('refuses an expired link and leaves the account pending (AC9)', async () => {
    const user = await pendingUser('a@example.com');
    const { token } = await activation.issue(user.id);
    clock.set(t0.getTime() + DAY + 1);
    await expect(activation.redeem(token, PASSWORD)).rejects.toBeInstanceOf(
      ActivationLinkExpiredError,
    );
    expect((await users.findOneByOrFail({ id: user.id })).status).toBe(
      'pending',
    );
    expect(cognito.enableUser).not.toHaveBeenCalled();
  });

  it('lets only one of two concurrent redemptions through', async () => {
    const user = await pendingUser('a@example.com');
    const { token } = await activation.issue(user.id);
    const results = await Promise.allSettled([
      activation.redeem(token, PASSWORD),
      activation.redeem(token, PASSWORD),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(cognito.setPermanentPassword).toHaveBeenCalledTimes(1);
  });

  it('rejects a password Cognito refuses without consuming the link', async () => {
    const user = await pendingUser('a@example.com');
    const { token } = await activation.issue(user.id);
    cognito.setPermanentPassword.mockRejectedValueOnce(
      new PasswordPolicyError(),
    );
    await expect(activation.redeem(token, 'weak')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    expect(tokens.rows[0].usedAt).toBeNull();
    await expect(activation.redeem(token, PASSWORD)).resolves.toBeUndefined();
  });
});
