import { EmailAlreadyRegisteredError, PasswordPolicyError } from './auth.errors';
import { User } from './entities/user.entity';
import { RegistrationService } from './registration.service';
import { FakeRepo, fakeCognito } from './testing/fakes';

const PASSWORD = 'test-password';

describe('RegistrationService', () => {
  let cognito: ReturnType<typeof fakeCognito>;
  let users: FakeRepo<User>;
  let registration: RegistrationService;

  const existingUser = (email: string) =>
    users.save({
      email,
      cognitoSub: `sub-${email}`,
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);

  beforeEach(() => {
    cognito = fakeCognito();
    users = new FakeRepo<User>();
    registration = new RegistrationService(users as never, cognito);
  });

  it('creates an account for a new visitor (AC2)', async () => {
    cognito.signUp.mockResolvedValue({ sub: 'sub-1' });
    const created = await registration.register(' Ada@Example.com ', PASSWORD);
    expect(cognito.signUp).toHaveBeenCalledWith('ada@example.com', PASSWORD);
    expect(created.email).toBe('ada@example.com');
    expect(users.rows).toEqual([
      expect.objectContaining({
        email: 'ada@example.com',
        cognitoSub: 'sub-1',
        status: 'active',
      }),
    ]);
  });

  it('refuses a duplicate email without calling Cognito', async () => {
    await existingUser('ada@example.com');
    await expect(
      registration.register('ada@example.com', PASSWORD),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(cognito.signUp).not.toHaveBeenCalled();
  });

  it('creates no row when Cognito rejects the password', async () => {
    cognito.signUp.mockRejectedValue(new PasswordPolicyError());
    await expect(registration.register('a@b.com', 'x')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    expect(users.rows).toHaveLength(0);
  });
});
