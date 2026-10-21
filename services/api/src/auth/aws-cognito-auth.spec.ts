import { ConfigService } from '@nestjs/config';
import { AwsCognitoAuth } from './aws-cognito-auth';
import { InvalidCredentialsError } from './auth.errors';

describe('AwsCognitoAuth', () => {
  const build = (response: unknown) => {
    const auth = new AwsCognitoAuth(new ConfigService({}));
    const send = jest.fn().mockResolvedValue(response);
    (auth as unknown as { client: { send: jest.Mock } }).client = { send };
    return auth;
  };

  it('throws instead of returning tokens when Cognito issues a challenge (AC8)', async () => {
    const auth = build({ ChallengeName: 'SMS_MFA', Session: 'x' });
    await expect(
      auth.signIn('a@example.com', 'test-password'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('maps SDK failures to InvalidCredentialsError', async () => {
    const auth = new AwsCognitoAuth(new ConfigService({}));
    (auth as unknown as { client: unknown }).client = {
      send: jest.fn().mockRejectedValue(new Error('NotAuthorizedException')),
    };
    await expect(auth.signIn('a@example.com', 'bad')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});
