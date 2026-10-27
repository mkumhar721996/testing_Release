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
    email: string,
    password: string,
  ): Promise<{ id: string; email: string }> {
    const normalised = email.trim().toLowerCase();
    if (await this.users.findOneBy({ email: normalised })) {
      throw new EmailAlreadyRegisteredError();
    }
    const { sub } = await this.cognito.signUp(normalised, password);
    const user = await this.users.save({
      email: normalised,
      cognitoSub: sub,
      status: 'active',
    } as User);
    return { id: user.id, email: user.email };
  }
}
