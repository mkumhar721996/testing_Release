import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InvalidCredentialsError, SignInRefusedError } from './auth.errors';
import { Clock } from './clock';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { User, type UserRole } from './entities/user.entity';
import { afterFailure, afterSuccess, isLocked } from './lockout.policy';
import { SessionService } from './session.service';

type Outcome =
  { refused: true } | { refused: false; user: User; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sessions: SessionService,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    private readonly clock: Clock,
  ) {}

  async signIn(
    email: string,
    password: string,
  ): Promise<{ sessionId: string; user: { id: string; email: string; role: UserRole } }> {
    // The row lock serialises attempts per account, so the lock check, the
    // Cognito call and the counter update cannot interleave across requests.
    // Refusals are returned, not thrown, so the failure count is committed.
    const outcome = await this.dataSource.transaction(
      async (manager): Promise<Outcome> => {
        const user = await manager.findOne(User, {
          where: { email: String(email).trim().toLowerCase() },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user || user.status !== 'active') return { refused: true };

        const now = this.clock.now();
        // Refuse before Cognito so a correct password during the lock still fails.
        if (isLocked(user, now)) return { refused: true };

        try {
          const result = await this.cognito.signIn(user.email, password);
          await manager.update(User, { id: user.id }, afterSuccess());
          return { refused: false, user, refreshToken: result.refreshToken };
        } catch (err) {
          // Anything but a credential refusal (e.g. an outage) is not a failed guess.
          if (!(err instanceof InvalidCredentialsError)) throw err;
          await manager.update(User, { id: user.id }, afterFailure(user, now));
          return { refused: true };
        }
      },
    );
    if (outcome.refused) throw new SignInRefusedError();

    const session = await this.sessions.create(
      outcome.user.id,
      outcome.refreshToken,
    );
    return {
      sessionId: session.id,
      user: {
        id: outcome.user.id,
        email: outcome.user.email,
        role: outcome.user.role,
      },
    };
  }

  async signOut(sessionId: string): Promise<void> {
    const session = await this.sessions.end(sessionId);
    if (session) await this.cognito.signOut(session.cognitoRefreshToken);
  }
}
