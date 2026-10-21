import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionService } from './session.service';
import { FakeClock, FakeRepo } from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');

describe('SessionService', () => {
  let clock: FakeClock;
  let sessions: SessionService;

  beforeEach(() => {
    clock = new FakeClock(t0);
    sessions = new SessionService(
      new FakeRepo<Session>() as unknown as Repository<Session>,
      clock,
    );
  });

  it('keeps a session alive while activity resets the 30 minute timer', async () => {
    const s = await sessions.create('user-1', 'r');
    clock.set(t0.getTime() + 29 * 60_000 + 59_000);
    expect(await sessions.touchIfActive(s.id)).not.toBeNull();
    clock.advance(30 * 60_000 - 1);
    expect(await sessions.touchIfActive(s.id)).not.toBeNull();
  });

  it('expires a session idle for exactly 30 minutes', async () => {
    const s = await sessions.create('user-1', 'r');
    clock.set(t0.getTime() + 30 * 60_000);
    expect(await sessions.touchIfActive(s.id)).toBeNull();
  });

  it('does not revive an expired session', async () => {
    const s = await sessions.create('user-1', 'r');
    clock.advance(30 * 60_000);
    await sessions.touchIfActive(s.id);
    clock.set(t0);
    expect(await sessions.touchIfActive(s.id)).toBeNull();
  });

  it('returns null for an ended or unknown session', async () => {
    const s = await sessions.create('user-1', 'r');
    await sessions.end(s.id);
    expect(await sessions.touchIfActive(s.id)).toBeNull();
    expect(await sessions.touchIfActive('nope')).toBeNull();
  });
});
