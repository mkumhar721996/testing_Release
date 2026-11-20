import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { COGNITO_AUTH } from '../src/auth/cognito-auth.port';
import { User } from '../src/auth/entities/user.entity';
import { fakeCognito } from '../src/auth/testing/fakes';
import { Employee } from '../src/employees/employee.entity';
import { ReceiptStorage } from '../src/expenses/receipt-storage';
import { InMemoryReceiptStorage } from '../src/expenses/testing/fakes';

const PASSWORD = 'test-password';

process.env.SESSION_ENCRYPTION_KEY ??= 'test-encryption-key';
process.env.EXPENSE_CATEGORIES = 'Meals,Travel';

describe('Expenses (e2e)', () => {
  let app: INestApplication;
  let agent: request.Agent;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const cognito = fakeCognito();
    cognito.signIn.mockResolvedValue({ refreshToken: 'r', sub: 'sub' });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(COGNITO_AUTH)
      .useValue(cognito)
      .overrideProvider(ReceiptStorage)
      .useValue(new InMemoryReceiptStorage())
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const ds = app.get(DataSource);
    const user = await ds.getRepository(User).save({
      email: `expenses${Date.now()}@example.com`,
      cognitoSub: 'sub',
      status: 'active',
      failedSignInCount: 0,
      lockStartedAt: null,
      role: 'employee',
    });
    await ds
      .getRepository(Employee)
      .save({ userId: user.id, displayName: 'Expense Tester' });
    agent = request.agent(app.getHttpServer());
    await agent.post('/auth/sign-in').send({ email: user.email, password: PASSWORD });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('offers exactly the configured categories (AC4)', async () => {
    const res = await agent.get('/expenses/options').expect(200);
    expect(res.body.categories).toEqual(['Meals', 'Travel']);
  });

  it('saves a draft without a receipt (AC2)', async () => {
    const res = await agent
      .post('/expenses')
      .field('amount', '12.50')
      .field('date', today)
      .field('category', 'Meals')
      .field('description', 'Lunch')
      .expect(201);
    expect(res.body).toMatchObject({ status: 'draft', amountMinor: 1250 });
  });

  it('saves a draft with a receipt (AC3)', async () => {
    const res = await agent
      .post('/expenses')
      .field('amount', '12.50')
      .field('date', today)
      .attach('receipt', Buffer.from('%PDF-1.4'), {
        filename: 'lunch.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(res.body.receiptKey).toMatch(/^receipts\//);
  });

  it('does not save without an amount (AC14)', async () => {
    await agent.post('/expenses').field('date', today).expect(400);
  });
});
