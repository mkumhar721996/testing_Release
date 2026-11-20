import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveEntry } from './leave-entry.entity';
import { LeaveType } from './leave-type.entity';

@Injectable()
export class LeaveTypesService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly types: Repository<LeaveType>,
    @InjectRepository(LeaveBalance)
    private readonly balances: Repository<LeaveBalance>,
    @InjectRepository(LeaveEntry)
    private readonly entries: Repository<LeaveEntry>,
  ) {}

  async list(): Promise<
    Array<{ id: string; name: string; exempt: boolean; balanceCount: number }>
  > {
    const types = await this.types.find({ order: { name: 'ASC' } });
    return Promise.all(
      types.map(async (t) => ({
        id: t.id,
        name: t.name,
        exempt: t.exempt,
        balanceCount: await this.balances.countBy({ leaveTypeId: t.id }),
      })),
    );
  }

  async create(input: { name: unknown; exempt?: unknown }): Promise<LeaveType> {
    const name = this.validName(input.name);
    const exempt = this.validExempt(input.exempt) ?? false;
    await this.assertNameFree(name);
    return this.types.save(this.types.create({ name, exempt }));
  }

  async update(
    id: string,
    input: { name?: unknown; exempt?: unknown },
  ): Promise<LeaveType> {
    const type = await this.types.findOneBy({ id });
    if (!type) throw new NotFoundException({ code: 'leave_type_not_found' });
    if (input.name !== undefined) {
      const name = this.validName(input.name);
      await this.assertNameFree(name, id);
      type.name = name;
    }
    const exempt = this.validExempt(input.exempt);
    if (exempt !== undefined) type.exempt = exempt;
    return this.types.save(type);
  }

  async remove(id: string): Promise<void> {
    const type = await this.types.findOneBy({ id });
    if (!type) throw new NotFoundException({ code: 'leave_type_not_found' });
    const inUse =
      (await this.balances.countBy({ leaveTypeId: id })) > 0 ||
      (await this.entries.countBy({ kind: id })) > 0;
    if (inUse) throw new ConflictException({ code: 'leave_type_in_use' });
    await this.types.delete({ id });
  }

  private validName(raw: unknown): string {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) throw new BadRequestException({ code: 'leave_type_name_invalid' });
    return name;
  }

  private validExempt(raw: unknown): boolean | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'boolean') {
      throw new BadRequestException({ code: 'leave_type_exempt_invalid' });
    }
    return raw;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const taken = (await this.types.find()).some(
      (t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw new ConflictException({ code: 'leave_type_name_taken' });
  }
}
