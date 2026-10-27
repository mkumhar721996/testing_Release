import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAlreadyRegisteredError } from './auth.errors';
import { COGNITO_AUTH, CognitoAuthPort } from './cognito-auth.port';
import { User } from './entities/user.entity';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
  ) {}

  async register(
    rawEmail: string,
    password: string,
  ): Promise<{ id: string; email: string }> {
    // Emails are stored lower-case, so this lookup is case-insensitive.
    const email = rawEmail.trim().toLowerCase();
    if (await this.users.findOneBy({ email })) {
      throw new EmailAlreadyRegisteredError();
    }
    const { sub } = await this.cognito.createUser(email, password);
    try {
      const user = await this.users.save({
        email,
        cognitoSub: sub,
        status: 'active',
        failedSignInCount: 0,
        lockStartedAt: null,
      } as User);
      return { id: user.id, email: user.email };
    } catch (err) {
      // No half-registered account: drop the Cognito user the row never joined.
      await this.cognito.deleteUser(email).catch(() => undefined);
      throw err;
    }
  }
}
