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

/**
 * In-memory stand-in for the slice of a TypeORM repository the services use.
 * Like a real database it hands out copies, so only saved state is observable.
 */
export class FakeRepo<T extends { id?: string }> {
  private stored: T[] = [];

  get rows(): T[] {
    return this.stored.map((r) => structuredClone(r));
  }

  async findOneBy(where: Partial<T>): Promise<T | null> {
    const row = this.stored.find((r) =>
      Object.entries(where).every(([k, v]) => (r as never)[k] === v),
    );
    return row ? structuredClone(row) : null;
  }

  async findOneByOrFail(where: Partial<T>): Promise<T> {
    const row = await this.findOneBy(where);
    if (!row) throw new Error('not found');
    return row;
  }

  async save(entity: T): Promise<T> {
    entity.id ??= randomUUID();
    const copy = structuredClone(entity);
    const i = this.stored.findIndex((r) => r.id === entity.id);
    if (i >= 0) this.stored[i] = copy;
    else this.stored.push(copy);
    return entity;
  }

  async update(where: Partial<T>, partial: Partial<T>): Promise<void> {
    this.stored
      .filter((r) =>
        Object.entries(where).every(([k, v]) => (r as never)[k] === v),
      )
      .forEach((r) => Object.assign(r, structuredClone(partial)));
  }
}

/**
 * Transactions run one at a time, which is what the pessimistic row lock the
 * real services request gives per row.
 */
export class FakeDataSource {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private repos: Map<unknown, FakeRepo<never>>) {}

  transaction<R>(fn: (manager: unknown) => Promise<R>): Promise<R> {
    const repo = (cls: unknown) => this.repos.get(cls)!;
    const manager = {
      findOne: (cls: unknown, opts: { where: never }) =>
        repo(cls).findOneBy(opts.where),
      update: (cls: unknown, where: never, partial: never) =>
        repo(cls).update(where, partial),
    };
    const run = this.queue.then(() => fn(manager));
    this.queue = run.catch(() => undefined);
    return run;
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
