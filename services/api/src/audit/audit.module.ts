import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntry } from './audit-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry])],
  exports: [TypeOrmModule],
})
export class AuditModule {}
