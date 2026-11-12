import type { Role } from './types';

export type AccessResult = 'allowed' | 'sign-in' | 'forbidden';

export function checkAccess(role: Role | null, allowedRoles?: readonly Role[]): AccessResult {
  if (!allowedRoles) return 'allowed';
  if (!role) return 'sign-in';
  return allowedRoles.includes(role) ? 'allowed' : 'forbidden';
}
