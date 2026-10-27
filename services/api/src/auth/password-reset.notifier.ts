import { Injectable, Logger } from '@nestjs/common';

export const PASSWORD_RESET_NOTIFIER = Symbol('PASSWORD_RESET_NOTIFIER');

/** Delivers the reset link out of band (e.g. email). */
export interface PasswordResetNotifier {
  notify(email: string, token: string, expiresAt: Date): Promise<void>;
}

/** Placeholder until an email-backed notifier exists; never logs the token. */
@Injectable()
export class LoggingPasswordResetNotifier implements PasswordResetNotifier {
  private readonly logger = new Logger(LoggingPasswordResetNotifier.name);

  async notify(_email: string, _token: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      `Password reset requested; link expires ${expiresAt.toISOString()}`,
    );
  }
}
