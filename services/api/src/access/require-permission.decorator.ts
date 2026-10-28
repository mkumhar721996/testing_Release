import { SetMetadata } from '@nestjs/common';
import { Action } from './permissions';

export const PERMISSION_KEY = 'permission';

export const RequirePermission = (action: Action) =>
  SetMetadata(PERMISSION_KEY, action);
