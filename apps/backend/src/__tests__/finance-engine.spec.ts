// apps/backend/src/__tests__/finance-engine.spec.ts
// ═══════════════════════════════════════════════════════════════
// Testes: Motor Financeiro — Idempotência, validações, relatórios
//
// Estrutura:
//   1. postPayable — idempotência, validação de status/conta
//   2. payPayable — idempotência, transição PAGO
//   3. postReceivable — idempotência
//   4. receiveReceivable — idempotência, transição RECEBIDO
//   5. reverseLedger — contra-lançamento, duplo estorno bloqueado
//   6. DRE — agrupamento por dre_section, cálculo resumo
//   7. CashFlow — realizado + projeção
// ═══════════════════════════════════════════════════════════════

import { LedgerService } from '../modules/financeiro/ledger.service';
import { ReportService } from '../modules/financeiro/report.service';

// ── Mock factories ──

function mockPayable(overrides: Record<string, any> = {}) {
  return {
    id: 'pay-001',
    unit_id: 'unit-001',
    unit_account_id: 'ua-001',
    description: 'Compra insumos',
    competence: '2026-01',
    value: { toNumber: () => 1500 },
    status: 'APROVADO',
    payment_method: 'BOLETO',
    unit_account: {
      master_account: { dre_section: 'CUSTO_SERVICO', nature: 'DESPESA' },
    },
    ...overrides,
  };
}

function mockReceivable(overrides: Record<string, any> = {}) {
  return {
    id: 'rec-001',
    unit_id: 'unit-001',
    unit_account_id: 'ua-002',
    source: 'Particular',
    competence: '2026-01',
    net_value: { toNumber: () => 8500 },
    status: 'PREVISTO',
    unit_account: {
      master_account: { dre_section: 'RECEITA_BRUTA', nature: 'RECEITA' },
    },
    ...overrides,
  };
}

function mockLedgerEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'le-001',
    unit_id: 'unit-001',
    unit_account_id: 'ua-001',
    competence: '2026-01',
    entry_date: new Date('2026-01-20'),
    amount: 1500,
    type: 'DEBIT',
    status: 'POSTED',
    source_type: 'PAYABLE',
    source_id: 'pay-001',
    description: 'AP: Compra insumos',
    posted_by: 'user-001',
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    payable: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    receivable: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cashMovement: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    unitAccount: { count: jest.fn() },
    $transaction: jest.fn(),
  } as any;
}

function createMockAudit() {
  return { logChange: jest.fn().mockResolvedValue(undefined) } as any;
}

// ═══════════════════════════════════════════════════════════════
// 1. postPayable
// ═══════════════════════════════════════════════════════════════

describe('LedgerService.postAP', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma, audit);
  });

  it('cria LedgerEntry DEBIT para payable APROVADO', async () => {
    prisma.payable.findUnique.mockResolvedValue(mockPayable());
    prisma.ledgerEntry.findUnique.mockResolvedValue(null); // não existe
    prisma.ledgerEntry.create.mockResolvedValue(mockLedgerEntry());

    const result = await service.postAP('pay-001', 'user-001');

    expect(result.type).toBe('DEBIT');
    expect(result.source_type).toBe('PAYABLE');
    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST_AP' }),
    );
  });

  it('IDEMPOTENTE: retorna existente sem criar novo', async () => {
    prisma.payable.findUnique.mockResolvedValue(mockPayable());
    prisma.ledgerEntry.findUnique.mockResolvedValue(mockLedgerEntry()); // JÁ existe

    const result = await service.postAP('pay-001', 'user-001');

    expect(result.id).toBe('le-001');
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    // Audit NÃO é chamado em retorno idempotente
    expect(audit.logChange).not.toHaveBeenCalled();
  });

  it('rejeita payable PENDENTE (não aprovado)', async () => {
    prisma.payable.findUnique.mockResolvedValue(
      mockPayable({ status: 'PENDENTE' }),
    );

    await expect(service.postAP('pay-001', 'user-001'))
      .rejects.toThrow('APROVADO ou AJUSTADO');
  });

  it('rejeita payable sem unit_account_id', async () => {
    prisma.payable.findUnique.mockResolvedValue(
      mockPayable({ unit_account_id: null }),
    );

    await expect(service.postAP('pay-001', 'user-001'))
      .rejects.toThrow('conta contábil');
  });

  it('rejeita payable inexistente', async () => {
    prisma.payable.findUnique.mockResolvedValue(null);

    await expect(service.postAP('pay-999', 'user-001'))
      .rejects.toThrow('não encontrado');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. payPayable
// ═══════════════════════════════════════════════════════════════

describe('LedgerService.payAP', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma, audit);
  });

  it('cria CashMovement OUT e marca PAGO', async () => {
    const payable = mockPayable();
    prisma.payable.findUnique.mockResolvedValue(payable);
    prisma.cashMovement.findUnique.mockResolvedValue(null);

    const mockMovement = {
      id: 'cm-001', direction: 'OUT', amount: 1500,
      unit_id: 'unit-001', source_type: 'PAYABLE',
    };
    prisma.$transaction.mockResolvedValue([
      { ...payable, status: 'PAGO' },
      mockMovement,
    ]);

    const result = await service.payAP('pay-001', 'user-001', 'bank-001');

    expect(result.direction).toBe('OUT');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAY_AP' }),
    );
  });

  it('IDEMPOTENTE: retorna CashMovement existente', async () => {
    prisma.payable.findUnique.mockResolvedValue(mockPayable());
    prisma.cashMovement.findUnique.mockResolvedValue({
      id: 'cm-001', direction: 'OUT', source_type: 'PAYABLE',
    });

    const result = await service.payAP('pay-001', 'user-001');

    expect(result.id).toBe('cm-001');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita payable PENDENTE', async () => {
    prisma.payable.findUnique.mockResolvedValue(
      mockPayable({ status: 'PENDENTE' }),
    );

    await expect(service.payAP('pay-001', 'user-001'))
      .rejects.toThrow('APROVADO');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. postReceivable
// ═══════════════════════════════════════════════════════════════

describe('LedgerService.postAR', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma, audit);
  });

  it('cria LedgerEntry CREDIT para receivable', async () => {
    prisma.receivable.findUnique.mockResolvedValue(mockReceivable());
    prisma.ledgerEntry.findUnique.mockResolvedValue(null);
    prisma.ledgerEntry.create.mockResolvedValue({
      ...mockLedgerEntry(),
      type: 'CREDIT',
      source_type: 'RECEIVABLE',
      source_id: 'rec-001',
    });

    const result = await service.postAR('rec-001', 'user-001');

    expect(result.type).toBe('CREDIT');
    expect(result.source_type).toBe('RECEIVABLE');
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST_AR' }),
    );
  });

  it('IDEMPOTENTE: retorna existente', async () => {
    prisma.receivable.findUnique.mockResolvedValue(mockReceivable());
    prisma.ledgerEntry.findUnique.mockResolvedValue(
      mockLedgerEntry({ source_type: 'RECEIVABLE', source_id: 'rec-001' }),
    );

    const result = await service.postAR('rec-001', 'user-001');

    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    expect(audit.logChange).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. receiveReceivable
// ═══════════════════════════════════════════════════════════════

describe('LedgerService.receiveAR', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma, audit);
  });

  it('cria CashMovement IN e marca RECEBIDO', async () => {
    prisma.receivable.findUnique.mockResolvedValue(mockReceivable());
    prisma.cashMovement.findUnique.mockResolvedValue(null);

    const mockMovement = {
      id: 'cm-002', direction: 'IN', amount: 8500,
      unit_id: 'unit-001', source_type: 'RECEIVABLE',
    };
    prisma.$transaction.mockResolvedValue([
      { ...mockReceivable(), status: 'RECEBIDO' },
      mockMovement,
    ]);

    const result = await service.receiveAR('rec-001', 'user-001', 'PIX');

    expect(result.direction).toBe('IN');
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RECEIVE_AR' }),
    );
  });

  it('IDEMPOTENTE: retorna CashMovement existente', async () => {
    prisma.receivable.findUnique.mockResolvedValue(mockReceivable());
    prisma.cashMovement.findUnique.mockResolvedValue({
      id: 'cm-002', direction: 'IN', source_type: 'RECEIVABLE',
    });

    const result = await service.receiveAR('rec-001', 'user-001', 'PIX');

    expect(result.id).toBe('cm-002');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. reverseLedger
// ═══════════════════════════════════════════════════════════════

describe('LedgerService.unpostLedger', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma, audit);
  });

  it('cria contra-lançamento (DEBIT→CREDIT) e marca REVERSED', async () => {
    const original = mockLedgerEntry({ type: 'DEBIT' });
    prisma.ledgerEntry.findUnique.mockResolvedValue(original);

    const reversal = {
      ...original,
      id: 'le-rev-001',
      type: 'CREDIT',
      source_type: 'MANUAL',
      source_id: 'le-001',
      description: 'ESTORNO: AP: Compra insumos',
    };
    prisma.$transaction.mockImplementation(async (fn: any) => {
      // Simular interactive transaction
      const tx = {
        ledgerEntry: {
          create: jest.fn().mockResolvedValue(reversal),
          update: jest.fn().mockResolvedValue({ ...original, status: 'REVERSED' }),
        },
      };
      return fn(tx);
    });

    const result = await service.unpostLedger('le-001', 'user-001', 'NF duplicada');

    expect(result.type).toBe('CREDIT'); // invertido
    expect(result.source_type).toBe('MANUAL');
    expect(audit.logChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UNPOST' }),
    );
  });

  it('bloqueia estorno de lançamento já REVERSED', async () => {
    prisma.ledgerEntry.findUnique.mockResolvedValue(
      mockLedgerEntry({ status: 'REVERSED' }),
    );

    await expect(service.unpostLedger('le-001', 'user-001', 'teste'))
      .rejects.toThrow('já estornado');
  });

  it('rejeita lançamento inexistente', async () => {
    prisma.ledgerEntry.findUnique.mockResolvedValue(null);

    await expect(service.unpostLedger('le-999', 'user-001', 'teste'))
      .rejects.toThrow('não encontrado');
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. DRE Report
// ═══════════════════════════════════════════════════════════════

describe('ReportService.getDre', () => {
  let service: ReportService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ReportService(prisma);
  });

  it('agrupa lançamentos por dre_section e calcula resumo', async () => {
    prisma.ledgerEntry.findMany.mockResolvedValue([
      // Receita: 3 consultas = 30000
      { amount: 10000, type: 'CREDIT', unit_account: { master_account: { dre_section: 'RECEITA_BRUTA', nature: 'RECEITA' } } },
      { amount: 10000, type: 'CREDIT', unit_account: { master_account: { dre_section: 'RECEITA_BRUTA', nature: 'RECEITA' } } },
      { amount: 10000, type: 'CREDIT', unit_account: { master_account: { dre_section: 'RECEITA_BRUTA', nature: 'RECEITA' } } },
      // Custo: 1 = 5000
      { amount: 5000, type: 'DEBIT', unit_account: { master_account: { dre_section: 'CUSTO_SERVICO', nature: 'DESPESA' } } },
      // Pessoal: 1 = 8000
      { amount: 8000, type: 'DEBIT', unit_account: { master_account: { dre_section: 'DESPESA_PESSOAL', nature: 'DESPESA' } } },
    ]);

    const result = await service.getDre('2026-01', '2026-01');

    expect(result.summary.receita_bruta).toBe(30000);
    expect(result.summary.custos).toBe(5000);
    expect(result.summary.lucro_bruto).toBe(25000); // 30000 - 0 - 5000
    expect(result.sections.length).toBe(13); // todas as seções DRE
    expect(result.consolidated).toBe(true); // sem unit_id = consolidado
  });

  it('filtra por unit_id quando informado', async () => {
    prisma.ledgerEntry.findMany.mockResolvedValue([]);

    await service.getDre('2026-01', '2026-03', 'unit-001', false);

    expect(prisma.ledgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ unit_id: 'unit-001' }),
      }),
    );
  });

  it('expande range de competências corretamente', async () => {
    prisma.ledgerEntry.findMany.mockResolvedValue([]);

    await service.getDre('2026-11', '2027-02');

    const call = prisma.ledgerEntry.findMany.mock.calls[0][0];
    expect(call.where.competence.in).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02',
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. CashFlow Report
// ═══════════════════════════════════════════════════════════════

describe('ReportService.getCashFlow', () => {
  let service: ReportService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      ...createMockPrisma(),
      payable: { findMany: jest.fn().mockResolvedValue([]) },
      receivable: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ReportService(prisma);
  });

  it('agrega movimentos por dia com acumulado', async () => {
    prisma.cashMovement.findMany.mockResolvedValue([
      {
        movement_date: new Date('2026-01-05'),
        amount: 8500, direction: 'IN',
        unit_account: { master_account: { code: '3.1.01.001', name: 'Consultas' } },
      },
      {
        movement_date: new Date('2026-01-05'),
        amount: 1500, direction: 'OUT',
        unit_account: { master_account: { code: '4.5.01', name: 'Aluguel' } },
      },
      {
        movement_date: new Date('2026-01-10'),
        amount: 3000, direction: 'OUT',
        unit_account: { master_account: { code: '4.1.02', name: 'Insumos' } },
      },
    ]);

    const result = await service.getCashFlow('2026-01-01', '2026-01-31', 'unit-001', 0);

    expect(result.total_in).toBe(8500);
    expect(result.total_out).toBe(4500);
    expect(result.net_balance).toBe(4000);
    expect(result.daily).toHaveLength(2); // 2 dias com movimento
    expect(result.daily[0].date).toBe('2026-01-05');
    expect(result.daily[0].entries_in).toBe(8500);
    expect(result.daily[0].entries_out).toBe(1500);
    expect(result.daily[0].cumulative).toBe(7000);
    expect(result.daily[1].cumulative).toBe(4000); // 7000 - 3000
    expect(result.by_account).toHaveLength(3);
  });

  it('marca dias projetados com is_projection=true', async () => {
    prisma.cashMovement.findMany.mockResolvedValue([]);
    prisma.payable.findMany.mockResolvedValue([
      { due_date: new Date('2026-02-15'), value: 2000 },
    ]);
    prisma.receivable.findMany.mockResolvedValue([
      { expected_date: new Date('2026-02-10'), net_value: 5000 },
    ]);

    const result = await service.getCashFlow('2026-01-01', '2026-01-31', undefined, 30);

    const projected = result.daily.filter((d) => d.is_projection);
    expect(projected.length).toBe(2);
    expect(projected[0].date).toBe('2026-02-10');
    expect(projected[0].entries_in).toBe(5000);
    expect(projected[1].date).toBe('2026-02-15');
    expect(projected[1].entries_out).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. Governança — canDelete
// ═══════════════════════════════════════════════════════════════

describe('LedgerService — governança', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new LedgerService(prisma, createMockAudit());
  });

  it('canDeleteMasterAccount retorna false se tem unit_accounts', async () => {
    prisma.unitAccount.count.mockResolvedValue(5);
    expect(await service.canDeleteMasterAccount('ma-001')).toBe(false);
  });

  it('canDeleteMasterAccount retorna true se não tem', async () => {
    prisma.unitAccount.count.mockResolvedValue(0);
    expect(await service.canDeleteMasterAccount('ma-001')).toBe(true);
  });

  it('canDeleteUnitAccount retorna false se tem lançamentos', async () => {
    prisma.ledgerEntry.count = jest.fn().mockResolvedValue(3);
    prisma.cashMovement.count = jest.fn().mockResolvedValue(0);
    expect(await service.canDeleteUnitAccount('ua-001')).toBe(false);
  });
});
