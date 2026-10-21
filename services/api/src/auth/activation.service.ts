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
      const row = await manager.findOneBy(ActivationToken, {
        tokenHash: hash(String(token)),
      });
      if (!row || row.usedAt) throw new ActivationLinkInvalidError();
      const now = this.clock.now();
      if (now.getTime() >= row.expiresAt.getTime()) {
        throw new ActivationLinkExpiredError();
      }
      const user = await manager.findOneBy(User, { id: row.userId });
      if (!user) throw new ActivationLinkInvalidError();

      await this.cognito.setPermanentPassword(user.email, password);
      await this.cognito.enableUser(user.email);
      user.status = 'active';
      row.usedAt = now;
      await manager.save(User, user);
      await manager.save(ActivationToken, row);
    });
  }
}
