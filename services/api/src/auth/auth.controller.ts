import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ActivationService } from './activation.service';
import {
  ACTIVATION_EXPIRED_MESSAGE,
  ACTIVATION_INVALID_MESSAGE,
  GENERIC_REFUSAL_MESSAGE,
  PASSWORD_POLICY_MESSAGE,
  SESSION_COOKIE,
} from './auth.constants';
import {
  ActivationLinkExpiredError,
  ActivationLinkInvalidError,
  PasswordPolicyError,
  SignInRefusedError,
} from './auth.errors';
import { AuthService } from './auth.service';
import { Role } from './role';
import { SessionGuard } from './session.guard';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly activation: ActivationService,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      if (
        typeof body?.email !== 'string' ||
        typeof body?.password !== 'string'
      ) {
        throw new SignInRefusedError();
      }
      const { sessionId, user } = await this.auth.signIn(
        body.email,
        body.password,
      );
      res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
      return { status: 'signed_in', user };
    } catch (err) {
      if (err instanceof SignInRefusedError) {
        throw new UnauthorizedException({ message: GENERIC_REFUSAL_MESSAGE });
      }
      throw err;
    }
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) await this.auth.signOut(sid);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('session')
  @UseGuards(SessionGuard)
  session(
    @Req()
    req: Request & { user?: { id: string; email: string; role: Role } },
  ) {
    return { user: req.user };
  }

  @Post('activate')
  @HttpCode(200)
  async activate(@Body() body: { token?: string; password?: string }) {
    try {
      if (
        typeof body?.token !== 'string' ||
        typeof body?.password !== 'string' ||
        !body.password
      ) {
        throw new ActivationLinkInvalidError();
      }
      await this.activation.redeem(body.token, body.password);
      return { status: 'activated' };
    } catch (err) {
      if (err instanceof ActivationLinkExpiredError) {
        throw new GoneException({
          code: 'activation_link_expired',
          message: ACTIVATION_EXPIRED_MESSAGE,
        });
      }
      if (err instanceof PasswordPolicyError) {
        throw new BadRequestException({
          code: 'password_policy',
          message: PASSWORD_POLICY_MESSAGE,
        });
      }
      if (err instanceof ActivationLinkInvalidError) {
        throw new BadRequestException({
          code: 'activation_link_invalid',
          message: ACTIVATION_INVALID_MESSAGE,
        });
      }
      throw err;
    }
  }
}
