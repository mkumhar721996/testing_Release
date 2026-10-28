import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { Product } from './entities/product.entity';
import { ProductNotFoundError } from './shop.errors';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  listProducts(): Promise<Product[]> {
    return this.products.find({
      where: { available: true },
      order: { name: 'ASC' },
    });
  }

  async placeOrder(userId: string, productId: string): Promise<Order> {
    const product = await this.products.findOneBy({
      id: productId,
      available: true,
    });
    if (!product) throw new ProductNotFoundError();
    return this.orders.save({
      userId,
      productId: product.id,
      quantity: 1,
      status: 'placed',
    } as Order);
  }
}
