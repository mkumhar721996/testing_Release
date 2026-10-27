export class SignInRefusedError extends Error {
  constructor() {
    super('Sign-in refused');
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
  }
}

export class ActivationLinkExpiredError extends Error {
  constructor() {
    super('Activation link expired');
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
  }
}

export class PasswordPolicyError extends Error {
  constructor() {
    super('Password does not meet the password policy');
  }
}

export class ActivationLinkInvalidError extends Error {
  constructor() {
    super('Activation link invalid');
  }
}

export class PasswordResetLinkExpiredError extends Error {
  constructor() {
    super('Password reset link expired');
  }
}

export class PasswordResetLinkInvalidError extends Error {
  constructor() {
    super('Password reset link invalid');
  }
}
