export function isWorkshopOperatorRole(role?: string | null): boolean {
  return role === 'operador_taller' || role === 'operator';
}

export function canRegisterPaymentsRole(role?: string | null): boolean {
  return !isWorkshopOperatorRole(role);
}

export function canManagePaymentsRole(role?: string | null): boolean {
  return role === 'super_admin';
}
