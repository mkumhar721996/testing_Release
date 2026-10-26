import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'api_service',
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
    AuthModule,
    AccessModule,
    EmployeesModule,
    LeaveModule,
    DashboardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
