import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivationService } from './activation.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AwsCognitoAuth } from './aws-cognito-auth';
import { Clock, SystemClock } from './clock';
import { COGNITO_AUTH } from './cognito-auth.port';
import { ActivationToken } from './entities/activation-token.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ActivationToken, Session])],
  controllers: [AuthController],
  providers: [
    AuthService,
    ActivationService,
    SessionService,
    SessionGuard,
    { provide: Clock, useClass: SystemClock },
    { provide: COGNITO_AUTH, useClass: AwsCognitoAuth },
  ],
  exports: [SessionGuard, SessionService, ActivationService, TypeOrmModule],
})
export class AuthModule {}
