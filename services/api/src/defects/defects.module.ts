import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { Defect } from './defect.entity';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Defect]), AccessModule, AuditModule],
  controllers: [DefectsController],
  providers: [DefectsService],
})
export class DefectsModule {}
