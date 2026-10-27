import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Order } from './entities/order.entity';
import { Product } from './entities/product.entity';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Order]), AuthModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
