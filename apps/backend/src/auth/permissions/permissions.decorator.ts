// apps/backend/src/auth/permissions/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Usage: @RequirePermissions(Permission.PAYABLE_APPROVE, Permission.PAYABLE_READ)
 * User must have ALL listed permissions.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
