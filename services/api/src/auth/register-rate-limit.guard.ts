import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  REGISTER_RATE_LIMIT,
  REGISTER_RATE_WINDOW_MS,
} from './auth.constants';

/** Per-client fixed-window limit for the unauthenticated register endpoint. */
@Injectable()
export class RegisterRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit = REGISTER_RATE_LIMIT,
    private readonly windowMs = REGISTER_RATE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const key = context.switchToHttp().getRequest<Request>().ip ?? 'unknown';
    const now = this.now();
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    const entry = this.hits.get(key) ?? { count: 0, resetAt: now + this.windowMs };
    entry.count += 1;
    this.hits.set(key, entry);
    if (entry.count > this.limit) {
      throw new HttpException(
        { message: 'Too many registration attempts. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
