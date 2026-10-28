import { Injectable, Logger } from '@nestjs/common';

export const ACTIVATION_NOTIFIER = Symbol('ACTIVATION_NOTIFIER');

/** Delivers the activation link out of band (e.g. email). */
export interface ActivationNotifier {
  notify(email: string, token: string, expiresAt: Date): Promise<void>;
}

/** Placeholder until an email-backed notifier exists; never logs the token. */
@Injectable()
export class LoggingActivationNotifier implements ActivationNotifier {
  private readonly logger = new Logger(LoggingActivationNotifier.name);

  async notify(_email: string, _token: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      `Activation link issued; link expires ${expiresAt.toISOString()}`,
    );
  }
}
