import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { Clock, SystemClock } from '../auth/clock';
import { Expense } from './expense.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ReceiptStorage } from './receipt-storage';
import { S3ReceiptStorage } from './s3-receipt-storage';

@Module({
  imports: [AccessModule, AuditModule, TypeOrmModule.forFeature([Expense])],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    { provide: Clock, useClass: SystemClock },
    { provide: ReceiptStorage, useClass: S3ReceiptStorage },
  ],
})
export class ExpensesModule {}
