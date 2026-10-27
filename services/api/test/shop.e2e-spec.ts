import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { fakeCognito } from '../src/auth/testing/fakes';
import { Order } from '../src/shop/entities/order.entity';
import { Product } from '../src/shop/entities/product.entity';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';

describe('Shop (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const cognito = fakeCognito();
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: 'sub' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(cognito)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  const signedInAgent = async () => {
    const user = await ds.getRepository(User).save({
      email: `shopper${Date.now()}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
    });
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/sign-in')
      .send({ email: user.email, password: 'test-password' })
      .expect(200);
    return agent;
  };

  const seedIphone = (available = true) =>
    ds.getRepository(Product).save({
      name: 'iPhone 16',
      category: 'phone',
      priceCents: 79900,
      available,
    });

  it('orders an iPhone from the shopping page (AC1)', async () => {
    const iphone = await seedIphone();
    const agent = await signedInAgent();
    const list = await agent.get('/products').expect(200);
    expect(list.body.map((p: Product) => p.id)).toContain(iphone.id);
    const res = await agent.post('/orders').send({ productId: iphone.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ productId: iphone.id, status: 'placed' });
    expect(
      await ds.getRepository(Order).countBy({ productId: iphone.id }),
    ).toBe(1);
  });

  it('requires a signed-in user', async () => {
    const iphone = await seedIphone();
    await request(app.getHttpServer()).get('/products').expect(401);
    await request(app.getHttpServer())
      .post('/orders')
      .send({ productId: iphone.id })
      .expect(401);
  });

  it('answers 404 for an unavailable, unknown or malformed product', async () => {
    const gone = await seedIphone(false);
    const agent = await signedInAgent();
    for (const body of [
      { productId: gone.id },
      { productId: '00000000-0000-4000-8000-000000000000' },
      { productId: 'not-a-uuid' },
      {},
    ]) {
      const res = await agent.post('/orders').send(body);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'product_not_found' });
    }
  });
});
