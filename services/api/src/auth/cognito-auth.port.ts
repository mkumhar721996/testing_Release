export interface CognitoAuthPort {
  /** Throws InvalidCredentialsError when Cognito refuses the credentials. */
  signIn(
    email: string,
    password: string,
  ): Promise<{ refreshToken: string; sub: string }>;
  signOut(refreshToken: string): Promise<void>;
  setPermanentPassword(email: string, password: string): Promise<void>;
  enableUser(email: string): Promise<void>;
}

export const COGNITO_AUTH = Symbol('COGNITO_AUTH');
