import { randomUUID } from 'crypto';
import { Clock } from '../clock';
import { CognitoAuthPort } from '../cognito-auth.port';

export class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(date: Date | number): void {
    this.current = new Date(date);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** In-memory stand-in for the slice of a TypeORM repository the services use. */
export class FakeRepo<T extends { id?: string }> {
  rows: T[] = [];

  async findOneBy(where: Partial<T>): Promise<T | null> {
    return (
      this.rows.find((r) =>
        Object.entries(where).every(([k, v]) => (r as never)[k] === v),
      ) ?? null
    );
  }

  async findOneByOrFail(where: Partial<T>): Promise<T> {
    const row = await this.findOneBy(where);
    if (!row) throw new Error('not found');
    return row;
  }

  async save(entity: T): Promise<T> {
    if (!this.rows.includes(entity)) {
      entity.id ??= randomUUID();
      this.rows.push(entity);
    }
    return entity;
  }
}

/** Runs the transaction callback directly against the in-memory repos. */
export class FakeDataSource {
  constructor(private repos: Map<unknown, FakeRepo<never>>) {}

  async transaction<R>(fn: (manager: unknown) => Promise<R>): Promise<R> {
    const repo = (cls: unknown) => this.repos.get(cls)!;
    return fn({
      findOneBy: (cls: unknown, where: never) => repo(cls).findOneBy(where),
      save: (cls: unknown, entity: never) => repo(cls).save(entity),
    });
  }
}

export function fakeCognito(): jest.Mocked<CognitoAuthPort> {
  return {
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    setPermanentPassword: jest.fn().mockResolvedValue(undefined),
    enableUser: jest.fn().mockResolvedValue(undefined),
  };
}
