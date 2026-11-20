import { Actor } from '../access/permissions';
import { DefectsController } from './defects.controller';

describe('DefectsController', () => {
  const actor: Actor = { id: 'u1', role: 'qa', employeeId: null };
  const setup = (found: unknown = { key: 'DEF-1', status: 'Fixed' }) => {
    const service = {
      findByKey: jest.fn().mockResolvedValue(found),
      move: jest.fn().mockResolvedValue({ key: 'DEF-1', status: 'Verified' }),
    };
    return { service, controller: new DefectsController(service as never) };
  };

  it('returns the defect with its allowed moves', async () => {
    const { controller } = setup();
    await expect(controller.get('DEF-1')).resolves.toMatchObject({
      allowedMoves: ['verify', 'fail_verification'],
    });
  });

  it('answers 404 for an unknown defect', async () => {
    const { controller } = setup(null);
    await expect(controller.get('DEF-9')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses an unknown move with 400 unknown_move', async () => {
    const { controller, service } = setup();
    await expect(
      controller.move({ actor }, 'DEF-1', { move: 'delete' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'unknown_move' },
    });
    expect(service.move).not.toHaveBeenCalled();
  });

  it('passes the move, trimmed-later fields and the actor to the service', async () => {
    const { controller, service } = setup();
    const result = await controller.move({ actor }, 'DEF-1', {
      move: 'reopen',
      reason: 'Seen again',
      originalKey: 42,
    });
    expect(service.move).toHaveBeenCalledWith(
      'DEF-1',
      'reopen',
      { reason: 'Seen again', originalKey: undefined },
      actor,
    );
    expect(result).toMatchObject({
      status: 'Verified',
      allowedMoves: ['close'],
    });
  });
});
