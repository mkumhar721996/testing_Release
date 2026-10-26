import { Injectable, Logger } from '@nestjs/common';

/** Delivers a reset token to its owner. An SES-backed binding is follow-up work (ADR-0010). */
export abstract class PasswordResetNotifier {
  abstract send(email: string, token: string): Promise<void>;
}

/** Default binding: records that a reset was issued, never the token. */
@Injectable()
export class LoggingPasswordResetNotifier extends PasswordResetNotifier {
  private readonly logger = new Logger(LoggingPasswordResetNotifier.name);

  async send(): Promise<void> {
    this.logger.log('Password reset issued; no mailer is configured');
  }
}
