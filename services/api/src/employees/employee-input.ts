import { BadRequestException } from '@nestjs/common';

export interface EmployeeInput {
  displayName: string;
  jobTitle: string;
  department: string;
  managerId: string;
  /** Annual pay in whole currency units, e.g. 52000.5. */
  payAnnual: number;
  contactEmail: string;
  phone: string;
}

/** The validated, storage-ready form of (part of) an EmployeeInput. */
export interface EmployeeFields {
  displayName: string;
  jobTitle: string;
  department: string;
  managerId: string;
  payAnnualMinor: number;
  contactEmail: string;
  phone: string;
}

export type ManagerOption = {
  id: string;
  displayName: string;
  isExecutive: boolean;
};

/** A direct report as a manager sees it: work details only, never pay. */
export type DirectReport = {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  managerName: string;
  contactEmail: string | null;
  phone: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reject = (code: string) => new BadRequestException({ code });

const text = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw reject(code);
  return value.trim();
};

const FIELD_RULES: {
  [K in keyof EmployeeInput]: (
    value: unknown,
    departments: string[],
  ) => EmployeeFields[keyof EmployeeFields];
} = {
  displayName: (v) => text(v, 'display_name_invalid'),
  jobTitle: (v) => text(v, 'job_title_invalid'),
  department: (v, departments) => {
    const department = text(v, 'department_invalid');
    if (!departments.includes(department)) throw reject('department_invalid');
    return department;
  },
  managerId: (v) => {
    if (v === undefined || v === null || v === '') {
      throw reject('manager_required');
    }
    if (typeof v !== 'string' || !UUID.test(v))
      throw reject('manager_not_found');
    return v;
  },
  payAnnual: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw reject('pay_invalid');
    }
    return Math.round(v * 100);
  },
  contactEmail: (v) => {
    const email = text(v, 'contact_email_invalid').toLowerCase();
    if (!EMAIL.test(email)) throw reject('contact_email_invalid');
    return email;
  },
  phone: (v) => text(v, 'phone_invalid'),
};

const STORAGE_KEY: Record<keyof EmployeeInput, keyof EmployeeFields> = {
  displayName: 'displayName',
  jobTitle: 'jobTitle',
  department: 'department',
  managerId: 'managerId',
  payAnnual: 'payAnnualMinor',
  contactEmail: 'contactEmail',
  phone: 'phone',
};

const INPUT_KEYS = Object.keys(FIELD_RULES) as (keyof EmployeeInput)[];

/**
 * Validates a request body into storage fields. On create every field is
 * required; on update only the fields present are checked and returned.
 */
export function parseEmployeeInput(
  body: unknown,
  departments: string[],
  mode: 'create' | 'update',
): Partial<EmployeeFields> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  for (const key of INPUT_KEYS) {
    if (mode === 'update' && !(key in raw)) continue;
    fields[STORAGE_KEY[key]] = FIELD_RULES[key](raw[key], departments);
  }
  if (mode === 'update' && Object.keys(fields).length === 0) {
    throw reject('no_changes');
  }
  return fields as Partial<EmployeeFields>;
}
