import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    const token = randomBytes(32).toString('hex');
    await this.tokens.save({
      userId: user.id,
      tokenHash: hash(token),
      expiresAt: new Date(
        this.clock.now().getTime() + PASSWORD_RESET_TOKEN_TTL_MS,
      ),
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
      if (!user) throw new PasswordResetLinkInvalidError();

      // A policy rejection throws here, rolling back with the link unused. If
      // the commit below fails after Cognito changed, the link is still unused
      // and the Cognito call is idempotent, so retrying the link is safe.
      await this.cognito.setPermanentPassword(user.email, password);
      await manager.update(User, { id: user.id }, afterSuccess());
      await manager.update(PasswordResetToken, { id: row.id }, { usedAt: now });
    });
  }
}
