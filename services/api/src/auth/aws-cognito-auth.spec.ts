import { ConfigService } from '@nestjs/config';
import { AwsCognitoAuth } from './aws-cognito-auth';
import { InvalidCredentialsError, PasswordPolicyError } from './auth.errors';

describe('AwsCognitoAuth', () => {
  const build = (response: unknown) => {
    const auth = new AwsCognitoAuth(new ConfigService({}));
    const send = jest.fn().mockResolvedValue(response);
    (auth as unknown as { client: { send: jest.Mock } }).client = { send };
    return auth;
  };

  it('throws instead of returning tokens when Cognito issues a challenge (AC8)', async () => {
    const auth = build({
      ChallengeName: 'SMS_MFA',
      AuthenticationResult: { RefreshToken: 'r' },
    });
    await expect(
      auth.signIn('a@example.com', 'test-password'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  const failing = (name: string) => {
    const auth = new AwsCognitoAuth(new ConfigService({}));
    const err = Object.assign(new Error(name), { name });
    (auth as unknown as { client: unknown }).client = {
      send: jest.fn().mockRejectedValue(err),
    };
    return auth;
  };

  it.each(['NotAuthorizedException', 'UserNotFoundException'])(
    'maps %s to InvalidCredentialsError',
    async (name) => {
      await expect(
        failing(name).signIn('a@example.com', 'bad'),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    },
  );

  it('rethrows infrastructure errors instead of calling them bad passwords', async () => {
    const err = failing('TooManyRequestsException');
    await expect(err.signIn('a@example.com', 'x')).rejects.not.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('maps InvalidPasswordException on activation to PasswordPolicyError', async () => {
    await expect(
      failing('InvalidPasswordException').setPermanentPassword('a@b.c', 'weak'),
    ).rejects.toBeInstanceOf(PasswordPolicyError);
  });
});
