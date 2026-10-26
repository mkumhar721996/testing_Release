import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AccessModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
