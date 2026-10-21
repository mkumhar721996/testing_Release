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
