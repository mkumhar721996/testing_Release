export interface CognitoAuthPort {
  /** Throws InvalidCredentialsError when Cognito refuses the credentials. */
  signIn(
    email: string,
    password: string,
  ): Promise<{ refreshToken: string; sub: string }>;
  signOut(refreshToken: string): Promise<void>;
  setPermanentPassword(email: string, password: string): Promise<void>;
  enableUser(email: string): Promise<void>;
  /** Creates a confirmed user with a permanent password. Throws EmailAlreadyRegisteredError / PasswordPolicyError. */
  createUser(email: string, password: string): Promise<{ sub: string }>;
  /** Removes a user, e.g. to undo a registration that could not be completed. */
  deleteUser(email: string): Promise<void>;
}

export const COGNITO_AUTH = Symbol('COGNITO_AUTH');
