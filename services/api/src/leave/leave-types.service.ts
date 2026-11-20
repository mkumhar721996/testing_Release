import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditEntry } from '../audit/audit-entry.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveEntry } from './leave-entry.entity';
import { LeaveType } from './leave-type.entity';

export interface LeaveTypeInput {
  name?: string;
  exempt?: boolean;
}

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LeaveType)
    private readonly types: Repository<LeaveType>,
  ) {}

  async list() {
    const [types, counts] = await Promise.all([
      this.types.find({ order: { name: 'ASC' } }),
      this.dataSource
        .getRepository(LeaveBalance)
        .createQueryBuilder('b')
        .select('b."leaveTypeId"', 'id')
        .addSelect('COUNT(*)', 'n')
        .groupBy('b."leaveTypeId"')
        .getRawMany<{ id: string; n: string }>(),
    ]);
    const balanceCounts = new Map(counts.map((c) => [c.id, Number(c.n)]));
    return types.map((t) => ({
      id: t.id,
      name: t.name,
      exempt: t.exempt,
      balanceCount: balanceCounts.get(t.id) ?? 0,
    }));
  }

  async create(input: LeaveTypeInput, actorUserId: string): Promise<LeaveType> {
    const fields = this.parse(input, true);
    return this.dataSource.transaction(async (em) => {
      await this.assertNameFree(em, fields.name as string);
      const saved = await em.save(LeaveType, {
        name: fields.name as string,
        exempt: fields.exempt ?? false,
      });
      await this.audit(em, actorUserId, 'create', saved.id, { ...saved });
      return saved;
    });
  }

  async update(
    id: string,
    input: LeaveTypeInput,
    actorUserId: string,
  ): Promise<LeaveType> {
    const fields = this.parse(input, false);
    return this.dataSource.transaction(async (em) => {
      const current = await this.find(em, id);
      if (fields.name !== undefined) {
        await this.assertNameFree(em, fields.name, id);
      }
      const saved = await em.save(LeaveType, { ...current, ...fields });
      await this.audit(em, actorUserId, 'update', id, { ...fields });
      return saved;
    });
  }

  remove(id: string, actorUserId: string): Promise<void> {
    return this.dataSource.transaction(async (em) => {
      const current = await this.find(em, id);
      const used =
        (await em.countBy(LeaveBalance, { leaveTypeId: id })) +
        (await em.countBy(LeaveEntry, { kind: id }));
      if (used > 0) {
        throw new ConflictException({ code: 'leave_type_in_use' });
      }
      await em.delete(LeaveType, { id });
      await this.audit(em, actorUserId, 'delete', id, { name: current.name });
    });
  }

  private parse(input: LeaveTypeInput, requireName: boolean): LeaveTypeInput {
    const fields: LeaveTypeInput = {};
    if (input.name !== undefined || requireName) {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name) {
        throw new BadRequestException({ code: 'leave_type_name_invalid' });
      }
      fields.name = name;
    }
    if (input.exempt !== undefined) {
      if (typeof input.exempt !== 'boolean') {
        throw new BadRequestException({ code: 'leave_type_exempt_invalid' });
      }
      fields.exempt = input.exempt;
    }
    return fields;
  }

  private async find(em: EntityManager, id: string): Promise<LeaveType> {
    const found = await em.findOneBy(LeaveType, { id });
    if (!found) throw new NotFoundException({ code: 'leave_type_not_found' });
    return found;
  }

  private async assertNameFree(
    em: EntityManager,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const all = await em.find(LeaveType);
    const lower = name.toLowerCase();
    if (all.some((t) => t.id !== exceptId && t.name.toLowerCase() === lower)) {
      throw new ConflictException({ code: 'leave_type_name_taken' });
    }
  }

  private audit(
    em: EntityManager,
    actorUserId: string,
    action: AuditEntry['action'],
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    return em.save(AuditEntry, {
      actorUserId,
      entity: 'leave_type',
      entityId,
      action,
      changes,
    });
  }
}
