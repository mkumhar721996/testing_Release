import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { PASSWORD_RESET_TOKEN_TTL_MS } from './auth.constants';
import {
  PasswordResetLinkExpiredError,
  PasswordResetLinkInvalidError,
} from './auth.errors';
import { Clock } from './clock';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { User } from './entities/user.entity';
import { afterSuccess } from './lockout.policy';
import {
  PASSWORD_RESET_NOTIFIER,
  PasswordResetNotifier,
} from './password-reset.notifier';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokens: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    @Inject(PASSWORD_RESET_NOTIFIER)
    private readonly notifier: PasswordResetNotifier,
    private readonly clock: Clock,
  ) {}

  /** Never reveals whether the email belongs to an account. */
  async request(email: string): Promise<void> {
    const user = await this.users.findOneBy({
      email: String(email).trim().toLowerCase(),
    });
    if (!user || user.status !== 'active') return;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      this.clock.now().getTime() + PASSWORD_RESET_TOKEN_TTL_MS,
    );
    const now = this.clock.now();
    // Only the newest link works.
    await this.tokens.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: now },
    );
    await this.tokens.save({
      userId: user.id,
      tokenHash: hash(token),
      expiresAt,
      usedAt: null,
    } as PasswordResetToken);
    await this.notifier.notify(user.email, token, expiresAt);
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
      // Status may have changed since the link was issued.
      if (!user || user.status !== 'active') {
        throw new PasswordResetLinkInvalidError();
      }

      // A policy rejection throws here, rolling back with the link unused. If
      // the commit below fails after Cognito changed, the link is still unused
      // and the Cognito call is idempotent, so retrying the link is safe.
      await this.cognito.setPermanentPassword(user.email, password);
      await manager.update(User, { id: user.id }, afterSuccess());
      // Consumes this link and any other outstanding ones for the user.
      await manager.update(
        PasswordResetToken,
        { userId: user.id, usedAt: IsNull() },
        { usedAt: now },
      );
    });
  }
}
