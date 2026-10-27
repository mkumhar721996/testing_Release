import { ExecutionContext, HttpException } from '@nestjs/common';
import { RegisterRateLimitGuard } from './register-rate-limit.guard';

const ctx = (ip: string) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as unknown as ExecutionContext;

describe('RegisterRateLimitGuard', () => {
  it('rejects with 429 once a client exceeds the limit within the window', () => {
    let now = 0;
    const guard = new RegisterRateLimitGuard(2, 1000, () => now);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(() => guard.canActivate(ctx('1.1.1.1'))).toThrow(HttpException);
    expect(guard.canActivate(ctx('2.2.2.2'))).toBe(true);
    now = 1001;
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
  });
});
