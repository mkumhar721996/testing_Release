import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ACTIVATION_TOKEN_TTL_MS } from './auth.constants';
import {
  ActivationLinkExpiredError,
  ActivationLinkInvalidError,
} from './auth.errors';
import { Clock } from './clock';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { ActivationToken } from './entities/activation-token.entity';
import { User } from './entities/user.entity';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class ActivationService {
  constructor(
    @InjectRepository(ActivationToken)
    private readonly tokens: Repository<ActivationToken>,
    private readonly dataSource: DataSource,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    private readonly clock: Clock,
  ) {}

  async issue(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      this.clock.now().getTime() + ACTIVATION_TOKEN_TTL_MS,
    );
    await this.tokens.save({
      userId,
      tokenHash: hash(token),
      expiresAt,
      usedAt: null,
    } as ActivationToken);
    return { token, expiresAt };
  }

  async redeem(token: string, password: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // The row lock makes redemption single-use under concurrency.
      const row = await manager.findOne(ActivationToken, {
        where: { tokenHash: hash(String(token)) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || row.usedAt) throw new ActivationLinkInvalidError();
      const now = this.clock.now();
      if (now.getTime() >= row.expiresAt.getTime()) {
        throw new ActivationLinkExpiredError();
      }
      const user = await manager.findOne(User, { where: { id: row.userId } });
      if (!user) throw new ActivationLinkInvalidError();

      // A policy rejection throws here, rolling back with the link unused. If
      // the commit below fails after Cognito changed, the link is still unused
      // and both Cognito calls are idempotent, so retrying the link is safe.
      await this.cognito.setPermanentPassword(user.email, password);
      await this.cognito.enableUser(user.email);
      await manager.update(User, { id: user.id }, { status: 'active' });
      await manager.update(ActivationToken, { id: row.id }, { usedAt: now });
    });
  }
}
