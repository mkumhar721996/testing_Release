import { ConfigService } from '@nestjs/config';
import { AwsCognitoAuth } from './aws-cognito-auth';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  PasswordPolicyError,
} from './auth.errors';

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

  it('signUp creates the user then sets a permanent password and returns the sub (AC2)', async () => {
    const auth = build({
      User: { Attributes: [{ Name: 'sub', Value: 'sub-9' }] },
    });
    const send = (auth as unknown as { client: { send: jest.Mock } }).client
      .send;
    await expect(auth.signUp('a@b.com', 'test-password')).resolves.toEqual({
      sub: 'sub-9',
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(AdminCreateUserCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(AdminSetUserPasswordCommand);
    expect(send.mock.calls[1][0].input.Permanent).toBe(true);
  });

  it('signUp does not mark the email as verified', async () => {
    const auth = build({ User: { Attributes: [{ Name: 'sub', Value: 's' }] } });
    const send = (auth as unknown as { client: { send: jest.Mock } }).client
      .send;
    await auth.signUp('a@b.com', 'test-password');
    const attrs = send.mock.calls[0][0].input.UserAttributes;
    expect(attrs).not.toContainEqual({ Name: 'email_verified', Value: 'true' });
  });

  it('signUp deletes the created Cognito user when the password is rejected', async () => {
    const auth = new AwsCognitoAuth(new ConfigService({}));
    const send = jest
      .fn()
      .mockResolvedValueOnce({ User: { Attributes: [] } })
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), { name: 'InvalidPasswordException' }),
      )
      .mockResolvedValueOnce({});
    (auth as unknown as { client: unknown }).client = { send };
    await expect(auth.signUp('a@b.com', 'x')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    expect(send.mock.calls[2][0]).toBeInstanceOf(AdminDeleteUserCommand);
  });

  it('deleteUser removes the Cognito user', async () => {
    const auth = build({});
    const send = (auth as unknown as { client: { send: jest.Mock } }).client
      .send;
    await auth.deleteUser('a@b.com');
    expect(send.mock.calls[0][0]).toBeInstanceOf(AdminDeleteUserCommand);
  });

  it('maps UsernameExistsException on sign-up to EmailAlreadyRegisteredError', async () => {
    await expect(
      failing('UsernameExistsException').signUp('a@b.com', 'test-password'),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});
