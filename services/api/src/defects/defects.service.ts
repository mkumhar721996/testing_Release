import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Actor } from '../access/permissions';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Defect } from './defect.entity';
import { checkMove, DefectMove, MoveInput } from './defect-transitions';

@Injectable()
export class DefectsService {
  constructor(
    @InjectRepository(Defect) private readonly defects: Repository<Defect>,
    private readonly dataSource: DataSource,
  ) {}

  findByKey(key: string): Promise<Defect | null> {
    return this.defects.findOneBy({ key });
  }

  /** Applies one status move; a refused move writes nothing. */
  move(
    key: string,
    move: DefectMove,
    input: MoveInput,
    actor: Actor,
  ): Promise<Defect> {
    return this.dataSource.transaction(async (em) => {
      const defect = await em.findOneBy(Defect, { key });
      if (!defect) throw new NotFoundException({ code: 'not_found' });
      const result = checkMove(defect.status, move, actor.role, input);
      if (!result.ok) {
        if (result.code === 'illegal_transition') {
          throw new ConflictException({
            code: result.code,
            status: defect.status,
          });
        }
        if (result.code === 'forbidden') {
          throw new ForbiddenException({ code: result.code });
        }
        throw new BadRequestException({ code: result.code });
      }
      const reason = input.reason?.trim();
      const originalKey = input.originalKey?.trim();
      await em.update(Defect, { id: defect.id }, { status: result.to });
      await em.save(AuditEntry, {
        actorUserId: actor.id,
        entity: 'defect',
        entityId: defect.id,
        action: 'update',
        changes: {
          status: { from: defect.status, to: result.to },
          ...(move === 'duplicate' ? { originalKey } : { reason: reason || undefined }),
        },
      });
      return { ...defect, status: result.to };
    });
  }
}
