// ═══════════════════════════════════════════════════════════════
// apps/backend/src/modules/financeiro/ledger.service.ts
//
// Camada contábil: gera LedgerEntry (competência/DRE) e
// CashMovement (fluxo de caixa) de forma idempotente.
//
// REGRAS:
//   1. postAP: AP APROVADO → LedgerEntry DEBIT (competência)
//   2. payAP:  AP PAGO → CashMovement OUT (data pagamento)
//   3. postAR: AR PREVISTO → LedgerEntry CREDIT (competência)
//   4. receiveAR: AR RECEBIDO → CashMovement IN (data recebimento)
//   5. Idempotência via unique(source_type, source_id) + upsert/findFirst
//   6. Audit log em todas as ações críticas
// ═══════════════════════════════════════════════════════════════

import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditHelper } from '../../common/helpers/audit.helper';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditHelper,
  ) {}

  // ══════════════════════════════════════════════
  // postAP — Aprovar AP → gerar LedgerEntry (DEBIT)
  // ══════════════════════════════════════════════

  async postAP(payableId: string, userId: string) {
    // 1. Buscar AP com unit_account
    const payable = await this.prisma.payable.findUnique({
      where: { id: payableId },
      include: { unit_account: { include: { master_account: true } } },
    });

    if (!payable) throw new NotFoundException(`Payable ${payableId} não encontrado`);

    if (!['APROVADO', 'AJUSTADO'].includes(payable.status)) {
      throw new BadRequestException(
        `Payable deve estar APROVADO ou AJUSTADO para contabilizar. Status atual: ${payable.status}`,
      );
    }

    if (!payable.unit_account_id) {
      throw new BadRequestException('Payable sem conta contábil vinculada (unit_account_id)');
    }

    // 2. Idempotência: verificar se já existe
    const existing = await this.prisma.ledgerEntry.findUnique({
      where: { uq_ledger_source: { source_type: 'PAYABLE', source_id: payableId } },
    });

    if (existing) {
      this.logger.warn(`LedgerEntry já existe para PAYABLE ${payableId} — idempotente, retornando existente`);
      return existing;
    }

    // 3. Criar LedgerEntry
    const entry = await this.prisma.ledgerEntry.create({
      data: {
        unit_id: payable.unit_id,
        unit_account_id: payable.unit_account_id,
        competence: this.normalizeCompetence(payable.competence),
        entry_date: new Date(),
        amount: payable.value,
        type: 'DEBIT',       // Despesa = débito
        status: 'POSTED',
        source_type: 'PAYABLE',
        source_id: payableId,
        description: `AP: ${payable.description}`,
        posted_by: userId,
      },
    });

    // 4. Audit
    await this.audit.logChange({
      entity: 'ledger_entry',
      entity_id: entry.id,
      action: 'POST_AP',
      user_id: userId,
      unit_id: payable.unit_id,
      before: undefined,
      after: {
        ledger_id: entry.id,
        payable_id: payableId,
        amount: payable.value.toString(),
        competence: entry.competence,
      },
    });

    this.logger.log(`LedgerEntry ${entry.id} criado para PAYABLE ${payableId}`);
    return entry;
  }

  // ══════════════════════════════════════════════
  // payAP — Pagar AP → gerar CashMovement (OUT)
  // ══════════════════════════════════════════════

  async payAP(
    payableId: string,
    userId: string,
    bankAccountId?: string,
  ) {
    const payable = await this.prisma.payable.findUnique({
      where: { id: payableId },
    });

    if (!payable) throw new NotFoundException(`Payable ${payableId} não encontrado`);

    if (payable.status !== 'PAGO' && payable.status !== 'APROVADO' && payable.status !== 'AJUSTADO') {
      throw new BadRequestException(
        `Payable deve estar APROVADO/AJUSTADO/PAGO para gerar movimento de caixa. Status: ${payable.status}`,
      );
    }

    if (!payable.unit_account_id) {
      throw new BadRequestException('Payable sem conta contábil vinculada');
    }

    // Idempotência
    const existing = await this.prisma.cashMovement.findUnique({
      where: { uq_cash_source: { source_type: 'PAYABLE', source_id: payableId } },
    });

    if (existing) {
      this.logger.warn(`CashMovement já existe para PAYABLE ${payableId}`);
      return existing;
    }

    // Transação: marca PAGO + cria CashMovement
    const [updatedPayable, movement] = await this.prisma.$transaction([
      this.prisma.payable.update({
        where: { id: payableId },
        data: { status: 'PAGO', paid_at: new Date() },
      }),
      this.prisma.cashMovement.create({
        data: {
          unit_id: payable.unit_id,
          unit_account_id: payable.unit_account_id,
          bank_account_id: bankAccountId || null,
          movement_date: new Date(),
          amount: payable.value,
          direction: 'OUT',
          payment_method: payable.payment_method,
          source_type: 'PAYABLE',
          source_id: payableId,
          description: `Pgto: ${payable.description}`,
          recorded_by: userId,
        },
      }),
    ]);

    await this.audit.logChange({
      entity: 'cash_movement',
      entity_id: movement.id,
      action: 'PAY_AP',
      user_id: userId,
      unit_id: payable.unit_id,
      before: { status: payable.status },
      after: {
        cash_id: movement.id,
        payable_id: payableId,
        amount: payable.value.toString(),
        direction: 'OUT',
      },
    });

    this.logger.log(`CashMovement ${movement.id} criado para PAYABLE ${payableId}`);
    return movement;
  }

  // ══════════════════════════════════════════════
  // postAR — Lançar AR → gerar LedgerEntry (CREDIT)
  // ══════════════════════════════════════════════

  async postAR(receivableId: string, userId: string) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: receivableId },
      include: { unit_account: { include: { master_account: true } } },
    });

    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} não encontrado`);

    if (!receivable.unit_account_id) {
      throw new BadRequestException('Receivable sem conta contábil vinculada');
    }

    // Idempotência
    const existing = await this.prisma.ledgerEntry.findUnique({
      where: { uq_ledger_source: { source_type: 'RECEIVABLE', source_id: receivableId } },
    });

    if (existing) {
      this.logger.warn(`LedgerEntry já existe para RECEIVABLE ${receivableId}`);
      return existing;
    }

    const entry = await this.prisma.ledgerEntry.create({
      data: {
        unit_id: receivable.unit_id,
        unit_account_id: receivable.unit_account_id,
        competence: this.normalizeCompetence(receivable.competence),
        entry_date: new Date(),
        amount: receivable.net_value,
        type: 'CREDIT',      // Receita = crédito
        status: 'POSTED',
        source_type: 'RECEIVABLE',
        source_id: receivableId,
        description: `AR: ${receivable.source}`,
        posted_by: userId,
      },
    });

    await this.audit.logChange({
      entity: 'ledger_entry',
      entity_id: entry.id,
      action: 'POST_AR',
      user_id: userId,
      unit_id: receivable.unit_id,
      before: undefined,
      after: {
        ledger_id: entry.id,
        receivable_id: receivableId,
        amount: receivable.net_value.toString(),
        competence: entry.competence,
      },
    });

    return entry;
  }

  // ══════════════════════════════════════════════
  // receiveAR — Receber AR → gerar CashMovement (IN)
  // ══════════════════════════════════════════════

  async receiveAR(
    receivableId: string,
    userId: string,
    paymentMethod: string,
    bankAccountId?: string,
  ) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: receivableId },
    });

    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} não encontrado`);

    if (!receivable.unit_account_id) {
      throw new BadRequestException('Receivable sem conta contábil vinculada');
    }

    // Idempotência via unique constraint
    const existing = await this.prisma.cashMovement.findUnique({
      where: { uq_cash_source: { source_type: 'RECEIVABLE', source_id: receivableId } },
    });

    if (existing) {
      this.logger.warn(`CashMovement já existe para RECEIVABLE ${receivableId}`);
      return existing;
    }

    const [updatedReceivable, movement] = await this.prisma.$transaction([
      this.prisma.receivable.update({
        where: { id: receivableId },
        data: { status: 'RECEBIDO', received_at: new Date() },
      }),
      this.prisma.cashMovement.create({
        data: {
          unit_id: receivable.unit_id,
          unit_account_id: receivable.unit_account_id,
          bank_account_id: bankAccountId || null,
          movement_date: new Date(),
          amount: receivable.net_value,
          direction: 'IN',
          payment_method: paymentMethod as any,
          source_type: 'RECEIVABLE',
          source_id: receivableId,
          description: `Receb: ${receivable.source}`,
          recorded_by: userId,
        },
      }),
    ]);

    await this.audit.logChange({
      entity: 'cash_movement',
      entity_id: movement.id,
      action: 'RECEIVE_AR',
      user_id: userId,
      unit_id: receivable.unit_id,
      before: { status: receivable.status },
      after: {
        cash_id: movement.id,
        receivable_id: receivableId,
        amount: receivable.net_value.toString(),
        direction: 'IN',
      },
    });

    return movement;
  }

  // ══════════════════════════════════════════════
  // unpost — Estornar lançamento contábil
  // ══════════════════════════════════════════════

  async unpostLedger(ledgerEntryId: string, userId: string, reason: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: ledgerEntryId },
    });

    if (!entry) throw new NotFoundException(`LedgerEntry ${ledgerEntryId} não encontrado`);
    if (entry.status === 'REVERSED') throw new BadRequestException('Lançamento já estornado');

    // Interactive transaction: criar contra-lançamento, depois marcar original
    const reversal = await this.prisma.$transaction(async (tx) => {
      const rev = await tx.ledgerEntry.create({
        data: {
          unit_id: entry.unit_id,
          unit_account_id: entry.unit_account_id,
          competence: entry.competence,
          entry_date: new Date(),
          amount: entry.amount,
          type: entry.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          status: 'POSTED',
          source_type: 'MANUAL',
          source_id: entry.id,
          description: `ESTORNO: ${entry.description}`,
          posted_by: userId,
          reversal_reason: reason,
        },
      });

      await tx.ledgerEntry.update({
        where: { id: ledgerEntryId },
        data: { status: 'REVERSED', reversed_by_id: rev.id },
      });

      return rev;
    });

    await this.audit.logChange({
      entity: 'ledger_entry',
      entity_id: ledgerEntryId,
      action: 'UNPOST',
      user_id: userId,
      unit_id: entry.unit_id,
      before: { status: 'POSTED' },
      after: { status: 'REVERSED', reversal_id: reversal.id, reason },
    });

    return reversal;
  }

  // ══════════════════════════════════════════════
  // Governança: impedir exclusão de conta com lançamentos
  // ══════════════════════════════════════════════

  async canDeleteMasterAccount(masterAccountId: string): Promise<boolean> {
    const count = await this.prisma.unitAccount.count({
      where: { master_account_id: masterAccountId },
    });
    return count === 0;
  }

  async canDeleteUnitAccount(unitAccountId: string): Promise<boolean> {
    const [ledger, cash] = await Promise.all([
      this.prisma.ledgerEntry.count({ where: { unit_account_id: unitAccountId } }),
      this.prisma.cashMovement.count({ where: { unit_account_id: unitAccountId } }),
    ]);
    return ledger === 0 && cash === 0;
  }

  // ══════════════════════════════════════════════
  // Helper: normalizar competência "01/2026" → "2026-01"
  // ══════════════════════════════════════════════

  private normalizeCompetence(comp: string): string {
    // Se já está em "2026-01", retorna
    if (/^\d{4}-\d{2}$/.test(comp)) return comp;
    // Se está em "01/2026", converte
    const [month, year] = comp.split('/');
    if (year && month) return `${year}-${month.padStart(2, '0')}`;
    return comp;
  }
}
