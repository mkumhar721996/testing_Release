import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { User } from '../auth/entities/user.entity';
import { Employee } from './employee.entity';
import {
  EmployeeFields,
  EmployeeInput,
  ManagerOption,
  parseEmployeeInput,
} from './employee-input';

const SEARCH_LIMIT = 50;
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  findById(id: string): Promise<Employee | null> {
    return this.employees.findOneBy({ id });
  }

  search(q: string): Promise<Employee[]> {
    return this.employees
      .createQueryBuilder('e')
      .where('e."displayName" ILIKE :q', { q: `%${q.trim()}%` })
      .orderBy('e."displayName"', 'ASC')
      .take(SEARCH_LIMIT)
      .getMany();
  }

  async options(): Promise<{
    departments: string[];
    managers: ManagerOption[];
  }> {
    const rows = await this.employees
      .createQueryBuilder('e')
      .leftJoin(User, 'u', 'u.id = e."userId"')
      .select('e.id', 'id')
      .addSelect('e."displayName"', 'displayName')
      .addSelect('u.role', 'role')
      .orderBy('e."displayName"', 'ASC')
      .getRawMany<{ id: string; displayName: string; role: string | null }>();
    return {
      departments: this.departments(),
      managers: rows.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        isExecutive: r.role === 'read_only_executive',
      })),
    };
  }

  async create(
    input: Partial<EmployeeInput>,
    actorUserId: string,
  ): Promise<Employee> {
    const fields = parseEmployeeInput(
      input,
      this.departments(),
      'create',
    ) as EmployeeFields;
    try {
      return await this.dataSource.transaction(async (em) => {
        await this.assertManagerExists(em, fields.managerId);
        const saved = await em.save(Employee, {
          ...fields,
          userId: null,
          payCurrency: this.currency(),
        });
        await this.audit(em, actorUserId, 'create', saved.id, fields);
        return saved;
      });
    } catch (err) {
      throw await this.translate(err, fields.contactEmail);
    }
  }

  async update(
    id: string,
    patch: Partial<EmployeeInput>,
    actorUserId: string,
  ): Promise<Employee | null> {
    const fields = parseEmployeeInput(patch, this.departments(), 'update');
    try {
      return await this.dataSource.transaction(async (em) => {
        if (!(await em.existsBy(Employee, { id }))) return null;
        if (fields.managerId !== undefined) {
          await this.assertManagerExists(em, fields.managerId);
        }
        const changes: Partial<Employee> = { ...fields };
        if (fields.payAnnualMinor !== undefined) {
          changes.payCurrency = this.currency();
        }
        await em.update(Employee, { id }, changes);
        await this.audit(em, actorUserId, 'update', id, fields);
        return em.findOneBy(Employee, { id });
      });
    } catch (err) {
      throw await this.translate(err, fields.contactEmail);
    }
  }

  rename(
    id: string,
    displayName: string,
    actorUserId: string,
  ): Promise<Employee | null> {
    return this.update(id, { displayName }, actorUserId);
  }

  private departments(): string[] {
    return this.config
      .get<string>('EMPLOYEE_DEPARTMENTS', 'People,Finance,Platform')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }

  private currency(): string {
    return this.config.get<string>('PAY_CURRENCY', 'GBP');
  }

  private async assertManagerExists(
    em: EntityManager,
    managerId: string,
  ): Promise<void> {
    if (!(await em.existsBy(Employee, { id: managerId }))) {
      throw new BadRequestException({ code: 'manager_not_found' });
    }
  }

  private audit(
    em: EntityManager,
    actorUserId: string,
    action: AuditEntry['action'],
    entityId: string,
    changes: Partial<EmployeeFields>,
  ) {
    return em.save(AuditEntry, {
      actorUserId,
      entity: 'employee',
      entityId,
      action,
      changes: { ...changes },
    });
  }

  private async translate(
    err: unknown,
    contactEmail?: string,
  ): Promise<unknown> {
    if ((err as { code?: string })?.code !== PG_UNIQUE_VIOLATION) return err;
    const existing = contactEmail
      ? await this.employees.findOneBy({ contactEmail })
      : null;
    return new ConflictException({
      code: 'contact_email_taken',
      employeeId: existing?.id ?? null,
    });
  }
}
