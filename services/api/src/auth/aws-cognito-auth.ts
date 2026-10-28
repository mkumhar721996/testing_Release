import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { InvalidCredentialsError, PasswordPolicyError } from './auth.errors';
import { CognitoAuthPort } from './cognito-auth.port';

@Injectable()
export class AwsCognitoAuth implements CognitoAuthPort {
  private readonly logger = new Logger(AwsCognitoAuth.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly poolId: string;
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.poolId = config.get<string>('COGNITO_USER_POOL_ID') ?? '';
    this.clientId = config.get<string>('COGNITO_CLIENT_ID') ?? '';
    this.client = new CognitoIdentityProviderClient({
      region: config.get<string>('AWS_REGION'),
    });
  }

  async signIn(email: string, password: string) {
    let res;
    try {
      res = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: this.clientId,
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      );
    } catch (err) {
      const name = (err as Error).name;
      if (
        name === 'NotAuthorizedException' ||
        name === 'UserNotFoundException'
      ) {
        throw new InvalidCredentialsError();
      }
      // Outages, throttling and misconfiguration are not failed passwords.
      this.logger.error(`Cognito InitiateAuth failed: ${name}`);
      throw err;
    }
    // Any challenge (MFA or otherwise) is a failure: no second factor is ever requested.
    const refreshToken = res.AuthenticationResult?.RefreshToken;
    if (res.ChallengeName || !refreshToken) {
      throw new InvalidCredentialsError();
    }
    return { refreshToken, sub: await this.subFor(email) };
  }

  private async subFor(email: string): Promise<string> {
    const user = await this.client.send(
      new AdminGetUserCommand({ UserPoolId: this.poolId, Username: email }),
    );
    return (
      user.UserAttributes?.find((a) => a.Name === 'sub')?.Value ??
      user.Username ??
      ''
    );
  }

  async signOut(refreshToken: string): Promise<void> {
    await this.client.send(
      new RevokeTokenCommand({ ClientId: this.clientId, Token: refreshToken }),
    );
  }

  async setPermanentPassword(email: string, password: string): Promise<void> {
    try {
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.poolId,
          Username: email,
          Password: password,
          Permanent: true,
        }),
      );
    } catch (err) {
      if ((err as Error).name === 'InvalidPasswordException') {
        throw new PasswordPolicyError();
      }
      throw err;
    }
  }

  async createUser(email: string): Promise<{ sub: string }> {
    const res = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.poolId,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );
    const sub = res.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) throw new Error('Cognito did not return a user id');
    // Stays unusable until activation calls enableUser.
    await this.disableUser(email);
    return { sub };
  }

  async disableUser(email: string): Promise<void> {
    await this.client.send(
      new AdminDisableUserCommand({ UserPoolId: this.poolId, Username: email }),
    );
  }

  async enableUser(email: string): Promise<void> {
    await this.client.send(
      new AdminEnableUserCommand({ UserPoolId: this.poolId, Username: email }),
    );
  }
}
