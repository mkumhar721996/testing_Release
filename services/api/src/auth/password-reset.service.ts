import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  PASSWORD_RESET_REQUEST_COOLDOWN_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from './auth.constants';
import {
  PasswordResetLinkExpiredError,
  PasswordResetLinkInvalidError,
} from './auth.errors';
import { Clock } from './clock';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { afterSuccess } from './lockout.policy';
import { PasswordResetNotifier } from './password-reset.notifier';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    private readonly clock: Clock,
    private readonly notifier: PasswordResetNotifier,
  ) {}

  /** Returns normally whether or not the email is registered, so it cannot be probed. */
  async request(email: string): Promise<void> {
    const user = await this.users.findOneBy({
      email: String(email).trim().toLowerCase(),
      status: 'active',
    });
    if (!user) return;
    const now = this.clock.now();

    // Per-email throttle: a link issued within the cooldown is still fresh, so
    // repeated requests cannot flood the inbox or the table.
    const pending = await this.tokens.findOneBy({
      userId: user.id,
      usedAt: IsNull(),
    });
    if (
      pending &&
      pending.expiresAt.getTime() - PASSWORD_RESET_TOKEN_TTL_MS >
        now.getTime() - PASSWORD_RESET_REQUEST_COOLDOWN_MS
    ) {
      return;
    }
    // Only the newest link works, and unused rows never accumulate per user.
    await this.tokens.delete({ userId: user.id, usedAt: IsNull() });

    const token = randomBytes(32).toString('hex');
    await this.tokens.save({
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
      usedAt: null,
    } as PasswordResetToken);
    await this.notifier.send(user.email, token);
  }

  async redeem(token: string, password: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // The row lock makes redemption single-use under concurrency.
      const row = await manager.findOne(PasswordResetToken, {
        where: { tokenHash: hash(String(token)) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || row.usedAt) throw new PasswordResetLinkInvalidError();
      const now = this.clock.now();
      if (now.getTime() >= row.expiresAt.getTime()) {
        throw new PasswordResetLinkExpiredError();
      }
      const user = await manager.findOne(User, { where: { id: row.userId } });
      // The link may predate a change of the account's state.
      if (!user || user.status !== 'active') {
        throw new PasswordResetLinkInvalidError();
      }

      // A policy rejection throws here, rolling back with the link unused. If
      // the commit below fails after Cognito changed, the link is still unused
      // and the Cognito call is idempotent, so retrying the link is safe.
      await this.cognito.setPermanentPassword(user.email, password);
      await manager.update(User, { id: user.id }, afterSuccess());
      await manager.update(PasswordResetToken, { id: row.id }, { usedAt: now });
      // A session held under the old password must not outlive the reset.
      await manager.update(
        Session,
        { userId: user.id, endedAt: IsNull() },
        { endedAt: now },
      );
    });
  }
}
