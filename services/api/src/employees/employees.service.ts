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

  findById(id: string): Promise<Employee | null> {
    return this.employees.findOneBy({ id });
  }

  async rename(id: string, displayName: string): Promise<Employee | null> {
    await this.employees.update({ id }, { displayName });
    return this.findById(id);
  }
}
