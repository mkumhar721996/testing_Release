import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const row = { id: 'e1', userId: 'u1', displayName: 'New', managerId: null };

  it('lists employees by name with only id and displayName', async () => {
    const repo = { find: jest.fn().mockResolvedValue([row]) };
    const service = new EmployeesService(
      repo as unknown as Repository<Employee>,
    );
    await expect(service.list()).resolves.toEqual([
      { id: 'e1', displayName: 'New' },
    ]);
    expect(repo.find).toHaveBeenCalledWith({ order: { displayName: 'ASC' } });
  });

  it('updates only the display name and returns the stored row', async () => {
    const repo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn().mockResolvedValue(row),
    };
    const service = new EmployeesService(
      repo as unknown as Repository<Employee>,
    );
    await expect(service.rename('e1', 'New')).resolves.toEqual(row);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'e1' },
      { displayName: 'New' },
    );
  });
});
