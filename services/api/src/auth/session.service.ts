import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INACTIVITY_TIMEOUT_MS } from './auth.constants';
import { Clock } from './clock';
import { Session } from './entities/session.entity';
import { decrypt, encrypt, sha256 } from './token-crypto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly clock: Clock,
  ) {}

  /** The returned session carries the raw id (cookie value); only its hash is stored. */
  async create(userId: string, refreshToken: string): Promise<Session> {
    const now = this.clock.now();
    const rawId = randomBytes(32).toString('hex');
    const saved = await this.sessions.save({
      id: sha256(rawId),
      userId,
      cognitoRefreshToken: encrypt(refreshToken),
      createdAt: now,
      lastActivityAt: now,
      endedAt: null,
    } as Session);
    return this.present(saved, rawId);
  }

  /** Returns the session after sliding its window, or null when ended or idle >= 30 min. */
  async touchIfActive(sessionId: string): Promise<Session | null> {
    const session = await this.sessions.findOneBy({ id: sha256(sessionId) });
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
    return this.present(await this.sessions.save(session), sessionId);
  }

  /** Ends the session and returns it, or null when unknown or already ended. */
  async end(sessionId: string): Promise<Session | null> {
    const session = await this.sessions.findOneBy({ id: sha256(sessionId) });
    if (!session || session.endedAt) return null;
    session.endedAt = this.clock.now();
    return this.present(await this.sessions.save(session), sessionId);
  }

  private present(session: Session, rawId: string): Session {
    return {
      ...session,
      id: rawId,
      cognitoRefreshToken: decrypt(session.cognitoRefreshToken),
    };
  }
}
