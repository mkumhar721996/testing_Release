import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SESSION_COOKIE } from './auth.constants';
import { User } from './entities/user.entity';
import { SessionService } from './session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const sid = req.cookies?.[SESSION_COOKIE];
    const session = sid ? await this.sessions.touchIfActive(sid) : null;
    const user = session
      ? await this.users.findOneBy({ id: session.userId })
      : null;
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException({ code: 'session_expired' });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
