import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ACTIVATION_NOTIFIER,
  LoggingActivationNotifier,
} from './activation.notifier';
import { ActivationService } from './activation.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AwsCognitoAuth } from './aws-cognito-auth';
import { Clock, SystemClock } from './clock';
import { COGNITO_AUTH } from './cognito-auth.port';
import { ActivationToken } from './entities/activation-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import {
  LoggingPasswordResetNotifier,
  PASSWORD_RESET_NOTIFIER,
} from './password-reset.notifier';
import { PasswordResetService } from './password-reset.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ActivationToken,
      PasswordResetToken,
      Session,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ActivationService,
    PasswordResetService,
    { provide: PASSWORD_RESET_NOTIFIER, useClass: LoggingPasswordResetNotifier },
    { provide: ACTIVATION_NOTIFIER, useClass: LoggingActivationNotifier },
    SessionService,
    SessionGuard,
    { provide: Clock, useClass: SystemClock },
    { provide: COGNITO_AUTH, useClass: AwsCognitoAuth },
  ],
  exports: [
    SessionGuard,
    SessionService,
    ActivationService,
    ACTIVATION_NOTIFIER,
    COGNITO_AUTH,
    TypeOrmModule,
  ],
})
export class AuthModule {}
