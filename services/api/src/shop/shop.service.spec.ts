import { Repository } from 'typeorm';
import { FakeRepo } from '../auth/testing/fakes';
import { Order } from './entities/order.entity';
import { Product } from './entities/product.entity';
import { ProductNotFoundError } from './shop.errors';
import { ShopService } from './shop.service';

describe('ShopService', () => {
  let products: FakeRepo<Product>;
  let orders: FakeRepo<Order>;
  let service: ShopService;

  const addProduct = (name: string, available = true) =>
    products.save({
      name,
      category: 'phone',
      priceCents: 79900,
      available,
    } as Product);

  beforeEach(() => {
    products = new FakeRepo<Product>();
    orders = new FakeRepo<Order>();
    service = new ShopService(
      products as unknown as Repository<Product>,
      orders as unknown as Repository<Order>,
    );
  });

  it('places an order for an available iPhone (AC1)', async () => {
    const iphone = await addProduct('iPhone 16');
    const order = await service.placeOrder('user-1', iphone.id);
    expect(order).toMatchObject({
      userId: 'user-1',
      productId: iphone.id,
      status: 'placed',
    });
    expect(orders.rows).toHaveLength(1);
  });

  it('refuses a missing or unavailable product and saves no order', async () => {
    const gone = await addProduct('iPhone 1', false);
    await expect(service.placeOrder('user-1', 'missing-id')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    await expect(service.placeOrder('user-1', gone.id)).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    expect(orders.rows).toHaveLength(0);
  });
});
