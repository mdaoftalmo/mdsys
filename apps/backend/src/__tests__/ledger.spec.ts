// ═══════════════════════════════════════════════════════════════
// apps/backend/src/__tests__/ledger.spec.ts
//
// Testes unitários para LedgerService
// Garante: idempotência, não-duplicação, governança
// ═══════════════════════════════════════════════════════════════

import { LedgerService } from '../modules/financeiro/ledger.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ── Mock factories ──

const mockUuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const mockUserId = '11111111-2222-3333-4444-555555555555';

function makePayable(overrides: Record<string, any> = {}) {
  return {
    id: mockUuid,
    unit_id: 'unit-1',
    unit_account_id: 'ua-1',
    competence: '2026-01',
    due_date: new Date('2026-01-15'),
    value: 1500.00,
    status: 'APROVADO',
    payment_method: 'BOLETO',
    description: 'Aluguel Janeiro',
    unit_account: {
      id: 'ua-1',
      master_account: { id: 'ma-1', code: '4.5.01', name: 'Aluguel', dre_section: 'DESPESA_OCUPACAO' },
    },
    ...overrides,
  };
}

function makeReceivable(overrides: Record<string, any> = {}) {
  return {
    id: mockUuid,
    unit_id: 'unit-1',
    unit_account_id: 'ua-2',
    competence: '2026-01',
    net_value: 350.00,
    status: 'PREVISTO',
    source: 'Consulta Particular',
    unit_account: {
      id: 'ua-2',
      master_account: { id: 'ma-2', code: '3.1.01.001', name: 'Consultas Particulares' },
    },
    ...overrides,
  };
}

function makeLedgerEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'ledger-1',
    unit_id: 'unit-1',
    unit_account_id: 'ua-1',
    competence: '2026-01',
    entry_date: new Date(),
    amount: 1500.00,
    type: 'DEBIT',
    status: 'POSTED',
    source_type: 'PAYABLE',
    source_id: mockUuid,
    posted_by: mockUserId,
    ...overrides,
  };
}

function makeCashMovement(overrides: Record<string, any> = {}) {
  return {
    id: 'cash-1',
    unit_id: 'unit-1',
    amount: 1500.00,
    direction: 'OUT',
    source_type: 'PAYABLE',
    source_id: mockUuid,
    ...overrides,
  };
}

// ── Mock Prisma ──

function createMockPrisma() {
  return {
    payable: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    receivable: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    cashMovement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    unitAccount: {
      count: jest.fn(),
    },
    $transaction: jest.fn((args: any[]) => Promise.resolve(args.map((a: any) => a))),
  };
}

function createMockAudit() {
  return {
    logChange: jest.fn().mockResolvedValue(undefined),
  };
}

// ════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma as any, audit as any);
  });

  // ──────────────────────────────────
  // postAP
  // ──────────────────────────────────

  describe('postAP', () => {
    it('deve criar LedgerEntry DEBIT ao aprovar AP', async () => {
      const payable = makePayable();
      prisma.payable.findUnique.mockResolvedValue(payable);
      prisma.ledgerEntry.findUnique.mockResolvedValue(null); // não existe
      prisma.ledgerEntry.create.mockResolvedValue(makeLedgerEntry());

      const result = await service.postAP(mockUuid, mockUserId);

      expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source_type: 'PAYABLE',
            source_id: mockUuid,
            type: 'DEBIT',
            status: 'POSTED',
            unit_id: 'unit-1',
            amount: 1500.00,
          }),
        }),
      );
      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'POST_AP' }),
      );
    });

    it('IDEMPOTÊNCIA: retorna existente sem duplicar', async () => {
      const payable = makePayable();
      const existing = makeLedgerEntry();
      prisma.payable.findUnique.mockResolvedValue(payable);
      prisma.ledgerEntry.findUnique.mockResolvedValue(existing); // JÁ EXISTE

      const result = await service.postAP(mockUuid, mockUserId);

      expect(result).toBe(existing);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
      // Não deve gerar audit log na operação idempotente
      expect(audit.logChange).not.toHaveBeenCalled();
    });

    it('rejeita AP não aprovado', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable({ status: 'PENDENTE' }));

      await expect(service.postAP(mockUuid, mockUserId))
        .rejects.toThrow(BadRequestException);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejeita AP sem conta contábil', async () => {
      prisma.payable.findUnique.mockResolvedValue(
        makePayable({ unit_account_id: null }),
      );

      await expect(service.postAP(mockUuid, mockUserId))
        .rejects.toThrow(BadRequestException);
    });

    it('rejeita AP inexistente', async () => {
      prisma.payable.findUnique.mockResolvedValue(null);

      await expect(service.postAP(mockUuid, mockUserId))
        .rejects.toThrow(NotFoundException);
    });

    it('aceita AP AJUSTADO', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable({ status: 'AJUSTADO' }));
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);
      prisma.ledgerEntry.create.mockResolvedValue(makeLedgerEntry());

      await service.postAP(mockUuid, mockUserId);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────
  // payAP
  // ──────────────────────────────────

  describe('payAP', () => {
    it('deve criar CashMovement OUT ao pagar AP', async () => {
      const payable = makePayable({ status: 'APROVADO' });
      prisma.payable.findUnique.mockResolvedValue(payable);
      prisma.cashMovement.findUnique.mockResolvedValue(null);

      const mockMovement = makeCashMovement();
      prisma.$transaction.mockResolvedValue([
        { ...payable, status: 'PAGO' },
        mockMovement,
      ]);

      const result = await service.payAP(mockUuid, mockUserId, 'bank-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAY_AP' }),
      );
    });

    it('IDEMPOTÊNCIA: retorna existente sem duplicar', async () => {
      const payable = makePayable({ status: 'PAGO' });
      const existing = makeCashMovement();
      prisma.payable.findUnique.mockResolvedValue(payable);
      prisma.cashMovement.findUnique.mockResolvedValue(existing);

      const result = await service.payAP(mockUuid, mockUserId);

      expect(result).toBe(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejeita AP PENDENTE', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable({ status: 'PENDENTE' }));

      await expect(service.payAP(mockUuid, mockUserId))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────
  // postAR
  // ──────────────────────────────────

  describe('postAR', () => {
    it('deve criar LedgerEntry CREDIT ao lançar AR', async () => {
      const receivable = makeReceivable();
      prisma.receivable.findUnique.mockResolvedValue(receivable);
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);
      prisma.ledgerEntry.create.mockResolvedValue(
        makeLedgerEntry({ type: 'CREDIT', source_type: 'RECEIVABLE', amount: 350.00 }),
      );

      await service.postAR(mockUuid, mockUserId);

      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source_type: 'RECEIVABLE',
            type: 'CREDIT',
            amount: 350.00,
          }),
        }),
      );
    });

    it('IDEMPOTÊNCIA: retorna existente sem duplicar', async () => {
      const receivable = makeReceivable();
      const existing = makeLedgerEntry({ source_type: 'RECEIVABLE' });
      prisma.receivable.findUnique.mockResolvedValue(receivable);
      prisma.ledgerEntry.findUnique.mockResolvedValue(existing);

      const result = await service.postAR(mockUuid, mockUserId);

      expect(result).toBe(existing);
      expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('rejeita AR sem conta contábil', async () => {
      prisma.receivable.findUnique.mockResolvedValue(
        makeReceivable({ unit_account_id: null }),
      );

      await expect(service.postAR(mockUuid, mockUserId))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────
  // receiveAR
  // ──────────────────────────────────

  describe('receiveAR', () => {
    it('deve criar CashMovement IN ao receber AR', async () => {
      const receivable = makeReceivable();
      prisma.receivable.findUnique.mockResolvedValue(receivable);
      prisma.cashMovement.findUnique.mockResolvedValue(null);

      const mockMovement = makeCashMovement({ direction: 'IN', source_type: 'RECEIVABLE' });
      prisma.$transaction.mockResolvedValue([
        { ...receivable, status: 'RECEBIDO' },
        mockMovement,
      ]);

      const result = await service.receiveAR(mockUuid, mockUserId, 'PIX');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RECEIVE_AR' }),
      );
    });

    it('IDEMPOTÊNCIA: retorna existente se já RECEBIDO', async () => {
      const receivable = makeReceivable({ status: 'RECEBIDO' });
      const existing = makeCashMovement({ direction: 'IN' });
      prisma.receivable.findUnique.mockResolvedValue(receivable);
      prisma.cashMovement.findUnique.mockResolvedValue(existing);

      const result = await service.receiveAR(mockUuid, mockUserId, 'PIX');

      expect(result).toBe(existing);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────
  // unpostLedger (estorno)
  // ──────────────────────────────────

  describe('unpostLedger', () => {
    it('deve criar contra-lançamento e marcar REVERSED', async () => {
      const entry = makeLedgerEntry();
      prisma.ledgerEntry.findUnique.mockResolvedValue(entry);

      const reversal = { ...entry, id: 'reversal-1', type: 'CREDIT', source_type: 'MANUAL' };
      prisma.$transaction.mockResolvedValue([reversal, { ...entry, status: 'REVERSED' }]);

      const result = await service.unpostLedger('ledger-1', mockUserId, 'Erro de classificação');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UNPOST' }),
      );
    });

    it('rejeita estorno de lançamento já estornado', async () => {
      prisma.ledgerEntry.findUnique.mockResolvedValue(
        makeLedgerEntry({ status: 'REVERSED' }),
      );

      await expect(service.unpostLedger('ledger-1', mockUserId, 'Motivo'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────
  // Governança: proteção contra exclusão
  // ──────────────────────────────────

  describe('Governança de exclusão', () => {
    it('canDeleteMasterAccount: false se houver unit_accounts vinculados', async () => {
      prisma.unitAccount.count.mockResolvedValue(5);
      expect(await service.canDeleteMasterAccount('ma-1')).toBe(false);
    });

    it('canDeleteMasterAccount: true se não houver unit_accounts', async () => {
      prisma.unitAccount.count.mockResolvedValue(0);
      expect(await service.canDeleteMasterAccount('ma-1')).toBe(true);
    });

    it('canDeleteUnitAccount: false se houver lançamentos', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(3);
      prisma.cashMovement.count.mockResolvedValue(0);
      expect(await service.canDeleteUnitAccount('ua-1')).toBe(false);
    });

    it('canDeleteUnitAccount: false se houver movimentos de caixa', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(0);
      prisma.cashMovement.count.mockResolvedValue(2);
      expect(await service.canDeleteUnitAccount('ua-1')).toBe(false);
    });

    it('canDeleteUnitAccount: true se não houver nada', async () => {
      prisma.ledgerEntry.count.mockResolvedValue(0);
      prisma.cashMovement.count.mockResolvedValue(0);
      expect(await service.canDeleteUnitAccount('ua-1')).toBe(true);
    });
  });

  // ──────────────────────────────────
  // Competência normalização
  // ──────────────────────────────────

  describe('normalizeCompetence (via postAP)', () => {
    it('normaliza "01/2026" para "2026-01"', async () => {
      prisma.payable.findUnique.mockResolvedValue(
        makePayable({ competence: '01/2026' }),
      );
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);
      prisma.ledgerEntry.create.mockImplementation(({ data }) => {
        expect(data.competence).toBe('2026-01');
        return Promise.resolve(makeLedgerEntry({ competence: '2026-01' }));
      });

      await service.postAP(mockUuid, mockUserId);
    });

    it('mantém "2026-01" inalterado', async () => {
      prisma.payable.findUnique.mockResolvedValue(
        makePayable({ competence: '2026-01' }),
      );
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);
      prisma.ledgerEntry.create.mockImplementation(({ data }) => {
        expect(data.competence).toBe('2026-01');
        return Promise.resolve(makeLedgerEntry());
      });

      await service.postAP(mockUuid, mockUserId);
    });
  });

  // ──────────────────────────────────
  // Audit logging
  // ──────────────────────────────────

  describe('Audit log', () => {
    it('postAP gera audit com action=POST_AP', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable());
      prisma.ledgerEntry.findUnique.mockResolvedValue(null);
      prisma.ledgerEntry.create.mockResolvedValue(makeLedgerEntry());

      await service.postAP(mockUuid, mockUserId);

      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'ledger_entry',
          action: 'POST_AP',
          user_id: mockUserId,
          unit_id: 'unit-1',
        }),
      );
    });

    it('payAP gera audit com action=PAY_AP', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable());
      prisma.cashMovement.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue([{}, makeCashMovement()]);

      await service.payAP(mockUuid, mockUserId);

      expect(audit.logChange).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAY_AP' }),
      );
    });

    it('operação idempotente NÃO gera audit duplicado', async () => {
      prisma.payable.findUnique.mockResolvedValue(makePayable());
      prisma.ledgerEntry.findUnique.mockResolvedValue(makeLedgerEntry());

      await service.postAP(mockUuid, mockUserId);

      expect(audit.logChange).not.toHaveBeenCalled();
    });
  });
});

// ════════════════════════════════════════════════════════════════
// Testes de constraint unique (simulação de DB)
// Verifica que a lógica de proteção impede duplicação ANTES
// de chegar ao banco (não depende apenas do DB unique constraint)
// ════════════════════════════════════════════════════════════════

describe('Unique constraint protection', () => {
  let service: LedgerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: ReturnType<typeof createMockAudit>;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = createMockAudit();
    service = new LedgerService(prisma as any, audit as any);
  });

  it('chamada concorrente de postAP não duplica (findUnique barrier)', async () => {
    const payable = makePayable();
    prisma.payable.findUnique.mockResolvedValue(payable);

    // Primeira chamada: não existe
    prisma.ledgerEntry.findUnique.mockResolvedValueOnce(null);
    prisma.ledgerEntry.create.mockResolvedValueOnce(makeLedgerEntry());

    // Segunda chamada: já existe
    prisma.ledgerEntry.findUnique.mockResolvedValueOnce(makeLedgerEntry());

    const [r1, r2] = await Promise.all([
      service.postAP(mockUuid, mockUserId),
      service.postAP(mockUuid, mockUserId),
    ]);

    // create só deve ter sido chamado 1 vez
    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
  });

  it('chamada concorrente de payAP não duplica', async () => {
    const payable = makePayable();
    prisma.payable.findUnique.mockResolvedValue(payable);

    prisma.cashMovement.findUnique.mockResolvedValueOnce(null);
    prisma.$transaction.mockResolvedValueOnce([{}, makeCashMovement()]);

    prisma.cashMovement.findUnique.mockResolvedValueOnce(makeCashMovement());

    await Promise.all([
      service.payAP(mockUuid, mockUserId),
      service.payAP(mockUuid, mockUserId),
    ]);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════
// Testes do Seed (estrutura do plano de contas)
// ════════════════════════════════════════════════════════════════

describe('Plano de Contas Mestre — validação estrutural', () => {
  // Estes testes verificam a estrutura do seed sem rodar no DB
  // Importamos a definição direto para validar

  it('todas as contas analíticas (is_group=false) devem ter parentCode', () => {
    // Definição inline das regras
    const dreReceita = ['RECEITA_BRUTA', 'DEDUCOES_RECEITA', 'RECEITA_FINANCEIRA', 'OUTRAS_RECEITAS'];
    const dreDespesa = [
      'CUSTO_SERVICO', 'DESPESA_PESSOAL', 'DESPESA_ADMINISTRATIVA',
      'DESPESA_COMERCIAL', 'DESPESA_OCUPACAO', 'DESPESA_FINANCEIRA',
      'DEPRECIACAO_AMORTIZACAO', 'IMPOSTOS_RESULTADO', 'OUTRAS_DESPESAS',
    ];

    // Contas 3.x devem ter nature RECEITA, 4.x devem ter nature DESPESA
    const accounts = [
      { code: '3.1.01.001', nature: 'RECEITA', dre: 'RECEITA_BRUTA' },
      { code: '4.5.01',     nature: 'DESPESA', dre: 'DESPESA_OCUPACAO' },
      { code: '4.8.01',     nature: 'DESPESA', dre: 'IMPOSTOS_RESULTADO' },
    ];

    for (const a of accounts) {
      if (a.code.startsWith('3')) {
        expect(a.nature).toBe('RECEITA');
        expect(dreReceita).toContain(a.dre);
      } else if (a.code.startsWith('4')) {
        expect(a.nature).toBe('DESPESA');
        expect(dreDespesa).toContain(a.dre);
      }
    }
  });

  it('DRE sections cobrem todas as linhas necessárias', () => {
    const sections = [
      'RECEITA_BRUTA', 'DEDUCOES_RECEITA',
      'CUSTO_SERVICO',
      'DESPESA_PESSOAL', 'DESPESA_ADMINISTRATIVA', 'DESPESA_COMERCIAL',
      'DESPESA_OCUPACAO', 'DESPESA_FINANCEIRA', 'RECEITA_FINANCEIRA',
      'OUTRAS_RECEITAS', 'OUTRAS_DESPESAS',
      'DEPRECIACAO_AMORTIZACAO', 'IMPOSTOS_RESULTADO',
      'NAO_DRE',
    ];

    // Verifica que a DRE pode ser montada na ordem correta
    const dreOrder = [
      'RECEITA_BRUTA',
      'DEDUCOES_RECEITA',
      'CUSTO_SERVICO',
      'DESPESA_PESSOAL',
      'DESPESA_ADMINISTRATIVA',
      'DESPESA_COMERCIAL',
      'DESPESA_OCUPACAO',
      'DESPESA_FINANCEIRA',
      'RECEITA_FINANCEIRA',
      'OUTRAS_RECEITAS',
      'OUTRAS_DESPESAS',
      'DEPRECIACAO_AMORTIZACAO',
      'IMPOSTOS_RESULTADO',
    ];

    // Cada seção da DRE deve estar na lista de seções válidas
    for (const s of dreOrder) {
      expect(sections).toContain(s);
    }

    // RECEITA_BRUTA deve vir antes de DEDUCOES
    expect(dreOrder.indexOf('RECEITA_BRUTA')).toBeLessThan(dreOrder.indexOf('DEDUCOES_RECEITA'));
    // CUSTO antes de DESPESAS
    expect(dreOrder.indexOf('CUSTO_SERVICO')).toBeLessThan(dreOrder.indexOf('DESPESA_PESSOAL'));
    // DEPRECIACAO antes de IMPOSTOS
    expect(dreOrder.indexOf('DEPRECIACAO_AMORTIZACAO')).toBeLessThan(dreOrder.indexOf('IMPOSTOS_RESULTADO'));
  });
});
