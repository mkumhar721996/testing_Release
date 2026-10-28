export interface CognitoAuthPort {
  /** Throws InvalidCredentialsError when Cognito refuses the credentials. */
  signIn(
    email: string,
    password: string,
  ): Promise<{ refreshToken: string; sub: string }>;
  signOut(refreshToken: string): Promise<void>;
  setPermanentPassword(email: string, password: string): Promise<void>;
  enableUser(email: string): Promise<void>;
  /** Creates the user without sending Cognito's own message; the platform delivers the activation link. */
  createUser(email: string): Promise<{ sub: string }>;
  disableUser(email: string): Promise<void>;
}

export const COGNITO_AUTH = Symbol('COGNITO_AUTH');
