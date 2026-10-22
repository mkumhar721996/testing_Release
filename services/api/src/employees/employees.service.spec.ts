import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeesService, escapeLike } from './employees.service';

describe('escapeLike', () => {
  it('escapes %, _ and backslash so they match literally', () => {
    expect(escapeLike('m_lopez')).toBe('m\\_lopez');
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });
});

describe('EmployeesService', () => {
  it('rejects an unknown status', async () => {
    const service = new EmployeesService({} as Repository<Employee>);
    await expect(service.list(undefined, 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
