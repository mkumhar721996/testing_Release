import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EMPLOYEE_STATUSES,
  Employee,
  type EmployeeStatus,
} from './entities/employee.entity';

export type EmployeeListResponse = {
  employees: Employee[];
  counts: Record<'all' | EmployeeStatus, number>;
  total: number;
};

export const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) {}

  async list(q?: string, status?: string): Promise<EmployeeListResponse> {
    if (
      status !== undefined &&
      status !== 'all' &&
      !EMPLOYEE_STATUSES.includes(status as EmployeeStatus)
    ) {
      throw new BadRequestException({ message: 'Unknown status filter.' });
    }
    const term = typeof q === 'string' ? q.trim() : '';

    const searched = () => {
      const qb = this.employees.createQueryBuilder('e');
      if (term) {
        qb.where(
          "(e.name ILIKE :p ESCAPE '\\' OR e.email ILIKE :p ESCAPE '\\')",
          { p: `%${escapeLike(term)}%` },
        );
      }
      return qb;
    };

    const rows = await searched()
      .select('e.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('e.status')
      .getRawMany<{ status: EmployeeStatus; n: string }>();
    const counts = { all: 0, active: 0, on_leave: 0, inactive: 0 };
    for (const r of rows) {
      const n = Number(r.n);
      counts.all += n;
      if (r.status in counts) counts[r.status] = n;
    }

    const listQb = searched().orderBy('e.name', 'ASC');
    if (status && status !== 'all') {
      listQb.andWhere('e.status = :status', { status });
    }
    const [employees, total] = await Promise.all([
      listQb.getMany(),
      this.employees.count(),
    ]);
    return { employees, counts, total };
  }
}
