import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ACTIVATION_NOTIFIER,
  ActivationNotifier,
} from '../auth/activation.notifier';
import { ActivationService } from '../auth/activation.service';
import { COGNITO_AUTH, CognitoAuthPort } from '../auth/cognito-auth.port';
import { User } from '../auth/entities/user.entity';
import { ROLES, Role } from '../auth/role';
import { SessionService } from '../auth/session.service';
import { Employee } from '../employees/employee.entity';

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  status: User['status'];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRole(role: unknown): Role {
  if (role === undefined || role === null || role === '') {
    throw new BadRequestException({ code: 'role_required' });
  }
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    throw new BadRequestException({ code: 'role_invalid' });
  }
  return role as Role;
}

@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly sessions: SessionService,
    private readonly activation: ActivationService,
    @Inject(COGNITO_AUTH) private readonly cognito: CognitoAuthPort,
    @Inject(ACTIVATION_NOTIFIER) private readonly notifier: ActivationNotifier,
  ) {}

  async list(): Promise<AdminUserView[]> {
    const [users, employees] = await Promise.all([
      this.users.find(),
      this.employees.find(),
    ]);
    const names = new Map(employees.map((e) => [e.userId, e.displayName]));
    return users.map((u) => view(u, names.get(u.id) ?? null));
  }

  async invite(input: {
    email: unknown;
    displayName: unknown;
    role: unknown;
  }): Promise<AdminUserView> {
    const role = parseRole(input?.role);
    const email = String(input.email ?? '').trim().toLowerCase();
    const displayName = String(input.displayName ?? '').trim();
    if (!EMAIL.test(email)) {
      throw new BadRequestException({ code: 'email_invalid' });
    }
    if (!displayName) {
      throw new BadRequestException({ code: 'display_name_invalid' });
    }
    if (await this.users.findOneBy({ email })) {
      throw new ConflictException({ code: 'email_taken' });
    }

    const { sub } = await this.cognito.createUser(email);
    const user = await this.users.save({
      email,
      cognitoSub: sub,
      status: 'pending',
      role,
      failedSignInCount: 0,
      lockStartedAt: null,
    } as User);
    try {
      await this.employees.save({
        userId: user.id,
        displayName,
        managerId: null,
      } as Employee);
    } catch (err) {
      // No half-created account: the user row goes with the failed employee row.
      await this.users.delete({ id: user.id });
      throw err;
    }
    const { token, expiresAt } = await this.activation.issue(user.id);
    await this.notifier.notify(email, token, expiresAt);
    return view(user, displayName);
  }

  async changeRole(userId: string, role: unknown): Promise<AdminUserView> {
    const next = parseRole(role);
    const user = await this.find(userId);
    user.role = next;
    return this.present(await this.users.save(user));
  }

  /** The database write comes first so a Cognito outage cannot leave an account active. */
  async deactivate(userId: string): Promise<AdminUserView> {
    const user = await this.find(userId);
    if (user.status !== 'active') {
      throw new ConflictException({ code: 'invalid_state' });
    }
    user.status = 'deactivated';
    await this.users.save(user);
    const ended = await this.sessions.endAllForUser(user.id);
    for (const session of ended) {
      await this.bestEffort(() =>
        this.cognito.signOut(session.cognitoRefreshToken),
      );
    }
    await this.bestEffort(() => this.cognito.disableUser(user.email));
    return this.present(user);
  }

  async reactivate(userId: string): Promise<AdminUserView> {
    const user = await this.find(userId);
    if (user.status !== 'deactivated') {
      throw new ConflictException({ code: 'invalid_state' });
    }
    await this.cognito.enableUser(user.email);
    user.status = 'active';
    user.failedSignInCount = 0;
    user.lockStartedAt = null;
    return this.present(await this.users.save(user));
  }

  private async find(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id }).catch(() => null);
    if (!user) throw new NotFoundException({ code: 'user_not_found' });
    return user;
  }

  private async present(user: User): Promise<AdminUserView> {
    const employee = await this.employees.findOneBy({ userId: user.id });
    return view(user, employee?.displayName ?? null);
  }

  private async bestEffort(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(`Cognito call failed: ${(err as Error).message}`);
    }
  }
}

const view = (u: User, displayName: string | null): AdminUserView => ({
  id: u.id,
  email: u.email,
  displayName,
  role: u.role,
  status: u.status,
});
