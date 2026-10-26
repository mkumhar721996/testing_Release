import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../auth/role';
import { Employee } from '../employees/employee.entity';
import { Action, Actor, can, RecordTarget } from './permissions';
import { PERMISSION_KEY } from './require-permission.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_ACTIONS: Action[] = ['record:read', 'record:write'];

const refuse = () => new ForbiddenException({ code: 'forbidden' });

/** Refuses any non-GET request from the read-only executive. Use after SessionGuard. */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role === 'read_only_executive' && req.method !== 'GET') {
      throw refuse();
    }
    return true;
  }
}

/**
 * Enforces `@RequirePermission(action)` through the pure policy. Use after
 * SessionGuard. Leaves the caller as `req.actor`. An unknown or malformed
 * target id is refused like a forbidden one, so existence is not revealed.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<Action | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    const req = context.switchToHttp().getRequest();
    const user: { id: string; role: Role } = req.user;
    const own = await this.employees.findOneBy({ userId: user.id });
    const actor: Actor = {
      id: user.id,
      role: user.role,
      employeeId: own?.id ?? null,
    };
    req.actor = actor;
    if (!action) return true;

    let target: RecordTarget | undefined;
    if (RECORD_ACTIONS.includes(action)) {
      const id: unknown = req.params?.id;
      if (typeof id !== 'string' || !UUID.test(id)) throw refuse();
      const found = await this.employees.findOneBy({ id });
      if (!found) throw refuse();
      target = { employeeId: found.id, managerEmployeeId: found.managerId };
    }
    if (!can(actor, action, target)) throw refuse();
    return true;
  }
}
