import { EmailAlreadyRegisteredError, PasswordPolicyError } from './auth.errors';
import { User } from './entities/user.entity';
import { RegistrationService } from './registration.service';
import { FakeRepo, fakeCognito } from './testing/fakes';

describe('RegistrationService', () => {
  const build = () => {
    const users = new FakeRepo<User>();
    const cognito = fakeCognito();
    const registration = new RegistrationService(users as never, cognito);
    return { users, cognito, registration };
  };

  it('creates an active account for a normalised email (AC2)', async () => {
    const { users, cognito, registration } = build();
    cognito.createUser.mockResolvedValue({ sub: 'sub-1' });
    await registration.register('  New@Example.com ', 'test-password');
    expect(cognito.createUser).toHaveBeenCalledWith(
      'new@example.com',
      'test-password',
    );
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]).toMatchObject({
      email: 'new@example.com',
      cognitoSub: 'sub-1',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
    });
  });

  it('rejects an existing email, ignoring case, without calling Cognito', async () => {
    const { users, cognito, registration } = build();
    await users.save({ email: 'new@example.com' } as User);
    await expect(
      registration.register('NEW@example.com', 'test-password'),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(cognito.createUser).not.toHaveBeenCalled();
  });

  it('saves no row when Cognito rejects the password', async () => {
    const { users, cognito, registration } = build();
    cognito.createUser.mockRejectedValue(new PasswordPolicyError());
    await expect(
      registration.register('a@example.com', 'weak'),
    ).rejects.toBeInstanceOf(PasswordPolicyError);
    expect(users.rows).toHaveLength(0);
  });

  it('removes the Cognito user when saving the row fails', async () => {
    const { users, cognito, registration } = build();
    cognito.createUser.mockResolvedValue({ sub: 'sub-1' });
    jest.spyOn(users, 'save').mockRejectedValue(new Error('db down'));
    await expect(
      registration.register('a@example.com', 'test-password'),
    ).rejects.toThrow('db down');
    expect(cognito.deleteUser).toHaveBeenCalledWith('a@example.com');
  });
});
