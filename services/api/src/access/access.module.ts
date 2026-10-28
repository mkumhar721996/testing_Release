import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Employee } from '../employees/employee.entity';
import { PermissionGuard, ReadOnlyGuard } from './permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), AuthModule],
  providers: [PermissionGuard, ReadOnlyGuard],
  exports: [PermissionGuard, ReadOnlyGuard, TypeOrmModule, AuthModule],
})
export class AccessModule {}
