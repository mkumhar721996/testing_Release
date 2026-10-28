import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { SessionService } from './session.service';
import { FakeClock, FakeRepo } from './testing/fakes';

const t0 = new Date('2026-01-01T00:00:00Z');

describe('SessionService', () => {
  let clock: FakeClock;
  let sessions: SessionService;
  let repo: FakeRepo<Session>;

  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEY = 'test-encryption-key';
    clock = new FakeClock(t0);
    repo = new FakeRepo<Session>();
    sessions = new SessionService(
      repo as unknown as Repository<Session>,
      clock,
    );
  });

  it('stores neither the session id nor the refresh token in plaintext', async () => {
    const s = await sessions.create('user-1', 'refresh-token-value');
    const [row] = repo.rows;
    expect(row.id).not.toBe(s.id);
    expect(row.cognitoRefreshToken).not.toContain('refresh-token-value');
    expect((await sessions.end(s.id))?.cognitoRefreshToken).toBe(
      'refresh-token-value',
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

  it('ends every live session of one user and returns them (AC9)', async () => {
    const a = await sessions.create('user-1', 'ra');
    const b = await sessions.create('user-1', 'rb');
    const other = await sessions.create('user-2', 'rc');
    await sessions.end(b.id);
    const ended = await sessions.endAllForUser('user-1');
    expect(ended.map((s) => s.cognitoRefreshToken)).toEqual(['ra']);
    expect(await sessions.touchIfActive(a.id)).toBeNull();
    expect(await sessions.touchIfActive(other.id)).not.toBeNull();
  });

  it('returns null for an ended or unknown session', async () => {
    const s = await sessions.create('user-1', 'r');
    await sessions.end(s.id);
    expect(await sessions.touchIfActive(s.id)).toBeNull();
    expect(await sessions.touchIfActive('nope')).toBeNull();
  });
});
