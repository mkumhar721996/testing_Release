export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_EXPIRED_MESSAGE =
  'This password reset link has expired. Request a new one.';
export const PASSWORD_RESET_INVALID_MESSAGE =
  'This password reset link is not valid.';
export const SESSION_COOKIE = 'sid';
export const GENERIC_REFUSAL_MESSAGE = 'Incorrect email or password.';
export const ACTIVATION_EXPIRED_MESSAGE =
  'This activation link has expired. Request a new activation email.';
export const PASSWORD_POLICY_MESSAGE =
  'That password does not meet the password requirements. Choose a different one.';
export const ACTIVATION_INVALID_MESSAGE = 'This activation link is not valid.';
