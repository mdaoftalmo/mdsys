// apps/backend/src/auth/permissions/permissions.enum.ts

export enum Permission {
  // Financeiro
  PAYABLE_READ = 'payable:read',
  PAYABLE_CREATE = 'payable:create',
  PAYABLE_APPROVE = 'payable:approve',
  PAYABLE_ADJUST = 'payable:adjust',
  RECEIVABLE_READ = 'receivable:read',
  RECEIVABLE_CREATE = 'receivable:create',
  DRE_READ = 'dre:read',
  DRE_WRITE = 'dre:write',
  CONCILIACAO_READ = 'conciliacao:read',
  CONCILIACAO_EXECUTE = 'conciliacao:execute',
  LEDGER_POST = 'ledger:post',
  LEDGER_PAY = 'ledger:pay',
  LEDGER_REVERSE = 'ledger:reverse',

  // Estoque
  STOCK_READ = 'stock:read',
  STOCK_MOVE = 'stock:move',
  STOCK_ADMIN = 'stock:admin',

  // RH
  RH_READ = 'rh:read',
  RH_WRITE = 'rh:write',
  PAYROLL_READ = 'payroll:read',

  // Orientação Cirúrgica
  LEAD_READ = 'lead:read',
  LEAD_WRITE = 'lead:write',

  // Pacientes
  PATIENT_READ = 'patient:read',
  PATIENT_WRITE = 'patient:write',

  // PDV / Vendas
  SALES_READ = 'sales:read',
  SALES_WRITE = 'sales:write',
  SALES_RECEIVE = 'sales:receive',

  // ABASUS (SUS)
  ABASUS_READ = 'abasus:read',
  ABASUS_WRITE = 'abasus:write',
  ABASUS_CONFIRM = 'abasus:confirm',
  ABASUS_REPASSE = 'abasus:repasse',
  ABASUS_EXPORT = 'abasus:export',

  // BI & AI
  BI_READ = 'bi:read',
  AI_USE = 'ai:use',

  // Admin
  ADMIN_USERS = 'admin:users',
  ADMIN_CLOSE_MONTH = 'admin:close_month',
  ADMIN_REOPEN_MONTH = 'admin:reopen_month',
}

/**
 * Maps AccessLevel → Permission[].
 * FULL gets everything. Others get subsets.
 */
export const ACCESS_LEVEL_PERMISSIONS: Record<string, Permission[]> = {
  FULL: Object.values(Permission),

  FINANCEIRO: [
    Permission.PAYABLE_READ, Permission.PAYABLE_CREATE, Permission.PAYABLE_APPROVE,
    Permission.RECEIVABLE_READ, Permission.RECEIVABLE_CREATE,
    Permission.DRE_READ, Permission.DRE_WRITE,
    Permission.CONCILIACAO_READ, Permission.CONCILIACAO_EXECUTE,
    Permission.LEDGER_POST, Permission.LEDGER_PAY, Permission.LEDGER_REVERSE,
    Permission.STOCK_READ,
    Permission.RH_READ, Permission.PAYROLL_READ,
    Permission.LEAD_READ,
    Permission.PATIENT_READ, Permission.PATIENT_WRITE,
    Permission.SALES_READ, Permission.SALES_WRITE, Permission.SALES_RECEIVE,
    Permission.ABASUS_READ, Permission.ABASUS_WRITE, Permission.ABASUS_CONFIRM,
    Permission.ABASUS_REPASSE, Permission.ABASUS_EXPORT,
    Permission.BI_READ, Permission.AI_USE,
  ],

  SECRETARIA: [
    Permission.STOCK_READ, Permission.STOCK_MOVE,
    Permission.LEAD_READ, Permission.LEAD_WRITE,
    Permission.PATIENT_READ, Permission.PATIENT_WRITE,
    Permission.SALES_READ, Permission.SALES_WRITE, Permission.SALES_RECEIVE,
    Permission.ABASUS_READ, Permission.ABASUS_WRITE,
    Permission.RECEIVABLE_READ,
  ],
};

export function hasPermission(accessLevel: string, permission: Permission): boolean {
  const perms = ACCESS_LEVEL_PERMISSIONS[accessLevel];
  return perms ? perms.includes(permission) : false;
}
