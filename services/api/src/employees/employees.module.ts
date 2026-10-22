import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
