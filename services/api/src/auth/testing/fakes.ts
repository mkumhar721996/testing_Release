import { randomUUID } from 'crypto';
import { Clock } from '../clock';
import { CognitoAuthPort } from '../cognito-auth.port';
import { PasswordResetNotifier } from '../password-reset.notifier';

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
        Object.entries(where).every(([k, v]) => {
          const actual = (r as never)[k];
          // Understands TypeORM's IsNull() operator.
          return (v as { _type?: string } | null)?._type === 'isNull'
            ? actual === null
            : actual === v;
        }),
      )
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

export function fakeCognito(): jest.Mocked<CognitoAuthPort> {
  return {
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    setPermanentPassword: jest.fn().mockResolvedValue(undefined),
    enableUser: jest.fn().mockResolvedValue(undefined),
    signUp: jest.fn(),
  };
}

export function fakeNotifier(): jest.Mocked<PasswordResetNotifier> & {
  lastToken(): string;
} {
  const notify = jest.fn().mockResolvedValue(undefined);
  return {
    notify,
    lastToken: () => notify.mock.calls[notify.mock.calls.length - 1][1],
  };
}
