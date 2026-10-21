import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvalidCredentialsError, SignInRefusedError } from './auth.errors';
import { Clock } from './clock';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { User } from './entities/user.entity';
import { afterFailure, afterSuccess, isLocked } from './lockout.policy';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly sessions: SessionService,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    private readonly clock: Clock,
  ) {}

  async signIn(
    email: string,
    password: string,
  ): Promise<{ sessionId: string; user: { id: string; email: string } }> {
    const user = await this.users.findOneBy({
      email: String(email).trim().toLowerCase(),
    });
    if (!user || user.status !== 'active') throw new SignInRefusedError();

    const now = this.clock.now();
    // Refuse before Cognito so a correct password during the lock still fails.
    if (isLocked(user, now)) throw new SignInRefusedError();

    let result;
    try {
      result = await this.cognito.signIn(user.email, password);
    } catch (err) {
      if (!(err instanceof InvalidCredentialsError)) throw err;
      Object.assign(user, afterFailure(user, now));
      await this.users.save(user);
      throw new SignInRefusedError();
    }

    Object.assign(user, afterSuccess());
    await this.users.save(user);
    const session = await this.sessions.create(user.id, result.refreshToken);
    return {
      sessionId: session.id,
      user: { id: user.id, email: user.email },
    };
  }

  async signOut(sessionId: string): Promise<void> {
    const session = await this.sessions.end(sessionId);
    if (session) await this.cognito.signOut(session.cognitoRefreshToken);
  }
}
