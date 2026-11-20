import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionGuard, ReadOnlyGuard } from '../access/permission.guard';
import { Actor } from '../access/permissions';
import { RequirePermission } from '../access/require-permission.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ExpenseDraftInput, MAX_RECEIPT_BYTES } from './expense-input';
import { ExpensesService, ReceiptUpload } from './expenses.service';

@Controller('expenses')
@UseGuards(SessionGuard, ReadOnlyGuard, PermissionGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('options')
  @RequirePermission('expenses:write')
  options() {
    return this.expenses.options();
  }

  // One byte over the limit gets past multer so the service can reject it with
  // a code; a file of exactly the limit must be accepted.
  @Post()
  @RequirePermission('expenses:write')
  @UseInterceptors(
    FileInterceptor('receipt', { limits: { fileSize: MAX_RECEIPT_BYTES + 1 } }),
  )
  createDraft(
    @Req() req: { actor: Actor },
    @Body() body: Partial<ExpenseDraftInput>,
    @UploadedFile() receipt?: ReceiptUpload,
  ) {
    return this.expenses.createDraft(body, receipt, req.actor.id);
  }
}
