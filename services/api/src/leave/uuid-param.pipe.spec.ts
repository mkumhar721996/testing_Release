import { NotFoundException } from '@nestjs/common';
import { uuidParam } from './uuid-param.pipe';

describe('uuidParam', () => {
  const meta = { type: 'param' as const };

  it('passes a valid uuid through', async () => {
    const id = '3f2b8c1e-5a4d-4e6f-8a9b-0c1d2e3f4a5b';
    await expect(uuidParam('x').transform(id, meta)).resolves.toBe(id);
  });

  it.each(['abc', '123', ''])('maps %p to 404 with the given code', async (v) => {
    const err = await uuidParam('leave_type_not_found')
      .transform(v, meta)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect((err as NotFoundException).getResponse()).toEqual({
      code: 'leave_type_not_found',
    });
  });
});
