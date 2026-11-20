export const ROLES = [
  'employee',
  'manager',
  'hr_admin',
  'read_only_executive',
  'triager',
  'developer',
  'qa',
] as const;

export type Role = (typeof ROLES)[number];
