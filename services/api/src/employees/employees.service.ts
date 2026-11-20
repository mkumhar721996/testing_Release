import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) {}

  async list(): Promise<Array<{ id: string; displayName: string }>> {
    const rows = await this.employees.find({ order: { displayName: 'ASC' } });
    return rows.map(({ id, displayName }) => ({ id, displayName }));
  }

  findById(id: string): Promise<Employee | null> {
    return this.employees.findOneBy({ id });
  }

  async rename(id: string, displayName: string): Promise<Employee | null> {
    await this.employees.update({ id }, { displayName });
    return this.findById(id);
  }
}
