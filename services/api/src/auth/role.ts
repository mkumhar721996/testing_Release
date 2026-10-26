export const ROLES = [
  'employee',
  'manager',
  'hr_admin',
  'read_only_executive',
] as const;

export type Role = (typeof ROLES)[number];
