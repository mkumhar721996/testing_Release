export interface CognitoAuthPort {
  /** Throws InvalidCredentialsError when Cognito refuses the credentials. */
  signIn(
    email: string,
    password: string,
  ): Promise<{ refreshToken: string; sub: string }>;
  signOut(refreshToken: string): Promise<void>;
  setPermanentPassword(email: string, password: string): Promise<void>;
  enableUser(email: string): Promise<void>;
  /** Creates a confirmed user. Throws EmailAlreadyRegisteredError or PasswordPolicyError. */
  deleteUser(email: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ sub: string }>;
}

export const COGNITO_AUTH = Symbol('COGNITO_AUTH');
