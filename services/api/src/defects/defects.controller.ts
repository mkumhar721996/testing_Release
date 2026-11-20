import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { Defect } from './defect.entity';
import {
  DEFECT_MOVES,
  DefectMove,
  legalMoves,
} from './defect-transitions';
import { DefectsService } from './defects.service';

interface MoveBody {
  move?: unknown;
  reason?: unknown;
  originalKey?: unknown;
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
const withMoves = (defect: Defect) => ({
  ...defect,
  allowedMoves: legalMoves(defect.status),
});

@Controller('defects')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class DefectsController {
  constructor(private readonly defects: DefectsService) {}

  @Get(':key')
  @RequirePermission('defects:read')
  async get(@Param('key') key: string) {
    const defect = await this.defects.findByKey(key);
    if (!defect) throw new NotFoundException({ code: 'not_found' });
    return withMoves(defect);
  }

  @Post(':key/moves')
  async move(
    @Req() req: { actor: Actor },
    @Param('key') key: string,
    @Body() body: MoveBody,
  ) {
    if (!DEFECT_MOVES.includes(body?.move as DefectMove)) {
      throw new BadRequestException({ code: 'unknown_move' });
    }
    const defect = await this.defects.move(
      key,
      body.move as DefectMove,
      { reason: text(body.reason), originalKey: text(body.originalKey) },
      req.actor,
    );
    return withMoves(defect);
  }
}
