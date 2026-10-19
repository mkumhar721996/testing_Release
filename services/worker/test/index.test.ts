import { run } from '../src/index';

describe('run', () => {
  it('returns the worker status message', () => {
    expect(run()).toBe('comp_worker is running');
  });
});
