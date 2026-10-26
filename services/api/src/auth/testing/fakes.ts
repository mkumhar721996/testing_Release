import { randomUUID } from 'crypto';
import { FindOperator } from 'typeorm';
import { InvalidCredentialsError } from '../auth.errors';
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

  private matches(r: T, where: Partial<T>): boolean {
    return Object.entries(where).every(([k, v]) =>
      v instanceof FindOperator && v.type === 'isNull'
        ? (r as never)[k] === null
        : (r as never)[k] === v,
    );
  }

  async delete(where: Partial<T>): Promise<void> {
    this.stored = this.stored.filter((r) => !this.matches(r, where));
  }

  async findOneBy(where: Partial<T>): Promise<T | null> {
    const row = this.stored.find((r) => this.matches(r, where));
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
      .filter((r) => this.matches(r, where))
      .forEach((r) => Object.assign(r, structuredClone(partial)));
  }
}

/**
 * Transactions run concurrently. Like Postgres, a `pessimistic_write` lookup
 * blocks other lockers of the same row until the transaction finishes; a
 * lookup that does not ask for the lock gets no protection.
 */
export class FakeDataSource {
  private locks = new Map<string, Promise<void>>();

  constructor(private repos: Map<unknown, FakeRepo<never>>) {}

  async transaction<R>(fn: (manager: unknown) => Promise<R>): Promise<R> {
    const repo = (cls: unknown) => this.repos.get(cls)!;
    const releases: Array<() => void> = [];
    const manager = {
      findOne: async (
        cls: unknown,
        opts: { where: never; lock?: { mode: string } },
      ) => {
        if (opts.lock?.mode === 'pessimistic_write') {
          const key = `${(cls as { name: string }).name}:${JSON.stringify(opts.where)}`;
          while (this.locks.has(key)) await this.locks.get(key);
          let release!: () => void;
          this.locks.set(
            key,
            new Promise<void>((resolve) => {
              release = () => {
                this.locks.delete(key);
                resolve();
              };
            }),
          );
          releases.push(release);
        }
        return repo(cls).findOneBy(opts.where);
      },
      update: (cls: unknown, where: never, partial: never) =>
        repo(cls).update(where, partial),
    };
    try {
      return await fn(manager);
    } finally {
      releases.forEach((release) => release());
    }
  }
}

/** Cognito fake that keeps one password per email, so only the current one signs in. */
export function statefulCognito(
  initial: Record<string, string>,
): jest.Mocked<CognitoAuthPort> {
  const passwords = new Map(Object.entries(initial));
  return {
    signIn: jest.fn(async (email: string, password: string) => {
      if (passwords.get(email) !== password) throw new InvalidCredentialsError();
      return { refreshToken: 'r', sub: `sub-${email}` };
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
    setPermanentPassword: jest.fn(async (email: string, password: string) => {
      passwords.set(email, password);
    }),
    enableUser: jest.fn().mockResolvedValue(undefined),
  };
}

export function fakeCognito(): jest.Mocked<CognitoAuthPort> {
  return {
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    setPermanentPassword: jest.fn().mockResolvedValue(undefined),
    enableUser: jest.fn().mockResolvedValue(undefined),
  };
}
