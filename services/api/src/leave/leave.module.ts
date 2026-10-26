import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { LeaveController } from './leave.controller';
import { LeaveEntry } from './leave-entry.entity';

@Module({
  imports: [AccessModule, TypeOrmModule.forFeature([LeaveEntry])],
  controllers: [LeaveController],
})
export class LeaveModule {}
