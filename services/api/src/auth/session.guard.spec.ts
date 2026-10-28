import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

describe('SessionGuard', () => {
  const ctxFor = () => {
    const req: Record<string, unknown> = { cookies: { sid: 'x' } };
    return {
      req,
      ctx: {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext,
    };
  };
  const guardFor = (user: Partial<User>) =>
    new SessionGuard(
      { touchIfActive: jest.fn().mockResolvedValue({ userId: 'u1' }) } as unknown as SessionService,
      { findOneBy: jest.fn().mockResolvedValue(user) } as unknown as Repository<User>,
    );
  const base = { id: 'u1', email: 'a@x.com', role: 'employee' as const };

  it('lets an active user through', async () => {
    const { ctx } = ctxFor();
    await expect(guardFor({ ...base, status: 'active' }).canActivate(ctx)).resolves.toBe(true);
  });

  it.each(['deactivated', 'pending'] as const)(
    'refuses a %s user even with a live session (AC9)',
    async (status) => {
      const { ctx } = ctxFor();
      await expect(guardFor({ ...base, status }).canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );
});
