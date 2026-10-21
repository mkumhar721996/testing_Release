import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INACTIVITY_TIMEOUT_MS } from './auth.constants';
import { Clock } from './clock';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, refreshToken: string): Promise<Session> {
    const now = this.clock.now();
    return this.sessions.save({
      id: randomBytes(32).toString('hex'),
      userId,
      cognitoRefreshToken: refreshToken,
      createdAt: now,
      lastActivityAt: now,
      endedAt: null,
    } as Session);
  }

  /** Returns the session after sliding its window, or null when ended or idle >= 30 min. */
  async touchIfActive(sessionId: string): Promise<Session | null> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session || session.endedAt) return null;
    const now = this.clock.now();
    if (
      now.getTime() - session.lastActivityAt.getTime() >=
      INACTIVITY_TIMEOUT_MS
    ) {
      session.endedAt = now;
      await this.sessions.save(session);
      return null;
    }
    session.lastActivityAt = now;
    return this.sessions.save(session);
  }

  async end(sessionId: string): Promise<Session | null> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session || session.endedAt) return session;
    session.endedAt = this.clock.now();
    return this.sessions.save(session);
  }
}
