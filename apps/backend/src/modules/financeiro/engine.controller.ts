// apps/backend/src/modules/financeiro/engine.controller.ts
// ═══════════════════════════════════════════════════════════════
// Motor Financeiro Operacional
//
// Endpoints:
//   POST /finance/payables/:id/post      → LedgerEntry (competência)
//   POST /finance/payables/:id/pay       → CashMovement (caixa)
//   POST /finance/receivables/:id/post   → LedgerEntry (competência)
//   POST /finance/receivables/:id/receive → CashMovement (caixa)
//   POST /finance/ledger/:id/reverse     → Estorno contábil
//   GET  /finance/reports/dre            → DRE por competência
//   GET  /finance/reports/cashflow       → Fluxo de caixa realizado + projeção
// ═══════════════════════════════════════════════════════════════

import {
  Controller, Post, Get, Param, Body, Query, UseGuards,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { LedgerService } from './ledger.service';
import { ReportService } from './report.service';
import {
  PayPayableDto,
  ReceiveReceivableDto,
  ReverseLedgerDto,
  DreReportQueryDto,
  CashFlowReportQueryDto,
} from './dto/engine.dto';

@ApiTags('finance-engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('FULL', 'FINANCEIRO')
@Controller('finance')
export class EngineController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly reports: ReportService,
  ) {}

  // ══════════════════════════════════════════════
  // PAYABLES — Contabilizar e Pagar
  // ══════════════════════════════════════════════

  @Post('payables/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.LEDGER_POST)
  @ApiOperation({
    summary: 'Contabilizar AP → LedgerEntry (competência)',
    description: `
Cria um LedgerEntry tipo DEBIT na competência do Payable.
Pré-condição: status APROVADO ou AJUSTADO, unit_account_id preenchido.
Idempotente: chamadas repetidas retornam o lançamento existente (HTTP 200).
    `,
  })
  @ApiResponse({
    status: 200, description: 'LedgerEntry criado ou já existente',
    schema: {
      example: {
        id: 'a1b2c3d4-...',
        unit_id: 'u1u2u3u4-...',
        unit_account_id: 'ua1ua2-...',
        competence: '2026-01',
        entry_date: '2026-01-20',
        amount: '1500.00',
        type: 'DEBIT',
        status: 'POSTED',
        source_type: 'PAYABLE',
        source_id: 'p1p2p3p4-...',
        description: 'AP: Compra de insumos Jan/2026',
        posted_by: 'user-uuid-...',
        created_at: '2026-01-20T14:30:00.000Z',
      },
    },
  })
  async postPayable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledger.postAP(id, user.id);
  }

  @Post('payables/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.LEDGER_PAY)
  @ApiOperation({
    summary: 'Pagar AP → CashMovement OUT (caixa)',
    description: `
Cria CashMovement direção OUT e marca Payable como PAGO.
Pré-condição: status APROVADO, AJUSTADO ou PAGO (idempotente).
Opcional: bank_account_id para vincular à conta bancária.
Idempotente: chamadas repetidas retornam o movimento existente.
    `,
  })
  @ApiResponse({
    status: 200, description: 'CashMovement criado ou já existente',
    schema: {
      example: {
        id: 'cm1cm2-...',
        unit_id: 'u1u2u3u4-...',
        unit_account_id: 'ua1ua2-...',
        bank_account_id: 'ba1ba2-...',
        movement_date: '2026-01-20',
        amount: '1500.00',
        direction: 'OUT',
        payment_method: 'BOLETO',
        source_type: 'PAYABLE',
        source_id: 'p1p2p3p4-...',
        description: 'Pgto: Compra de insumos Jan/2026',
        created_at: '2026-01-20T14:35:00.000Z',
      },
    },
  })
  async payPayable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PayPayableDto,
  ) {
    return this.ledger.payAP(id, user.id, dto.bank_account_id);
  }

  // ══════════════════════════════════════════════
  // RECEIVABLES — Contabilizar e Receber
  // ══════════════════════════════════════════════

  @Post('receivables/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.LEDGER_POST)
  @ApiOperation({
    summary: 'Contabilizar AR → LedgerEntry CREDIT (competência)',
    description: `
Cria LedgerEntry tipo CREDIT na competência do Receivable.
Pré-condição: unit_account_id preenchido.
Idempotente via unique(source_type, source_id).
    `,
  })
  @ApiResponse({
    status: 200, description: 'LedgerEntry criado ou já existente',
    schema: {
      example: {
        id: 'le1le2-...',
        competence: '2026-01',
        amount: '8500.00',
        type: 'CREDIT',
        status: 'POSTED',
        source_type: 'RECEIVABLE',
        source_id: 'r1r2r3r4-...',
        description: 'AR: Particular',
      },
    },
  })
  async postReceivable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledger.postAR(id, user.id);
  }

  @Post('receivables/:id/receive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.LEDGER_PAY)
  @ApiOperation({
    summary: 'Receber AR → CashMovement IN (caixa)',
    description: `
Cria CashMovement direção IN e marca Receivable como RECEBIDO.
Requer payment_method. Opcional: bank_account_id.
Idempotente via unique(source_type, source_id).
    `,
  })
  @ApiResponse({
    status: 200, description: 'CashMovement criado ou já existente',
    schema: {
      example: {
        id: 'cm3cm4-...',
        amount: '8500.00',
        direction: 'IN',
        payment_method: 'PIX',
        source_type: 'RECEIVABLE',
        source_id: 'r1r2r3r4-...',
      },
    },
  })
  async receiveReceivable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReceiveReceivableDto,
  ) {
    return this.ledger.receiveAR(id, user.id, dto.payment_method, dto.bank_account_id);
  }

  // ══════════════════════════════════════════════
  // ESTORNO
  // ══════════════════════════════════════════════

  @Post('ledger/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.LEDGER_REVERSE)
  @ApiOperation({
    summary: 'Estornar lançamento contábil',
    description: `
Marca o LedgerEntry original como REVERSED e cria um contra-lançamento
(DEBIT→CREDIT ou CREDIT→DEBIT) com o mesmo valor e competência.
Motivo (reason) obrigatório. Não pode estornar lançamento já estornado.
    `,
  })
  @ApiResponse({
    status: 200, description: 'Contra-lançamento criado',
    schema: {
      example: {
        id: 'rev1rev2-...',
        type: 'CREDIT',
        status: 'POSTED',
        source_type: 'MANUAL',
        source_id: 'le-original-...',
        description: 'ESTORNO: AP: Compra duplicada',
        reversal_reason: 'NF duplicada identificada na conciliação',
      },
    },
  })
  async reverseLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReverseLedgerDto,
  ) {
    return this.ledger.unpostLedger(id, user.id, dto.reason);
  }

  // ══════════════════════════════════════════════
  // RELATÓRIOS
  // ══════════════════════════════════════════════

  @Get('reports/dre')
  @RequirePermissions(Permission.DRE_READ)
  @ApiOperation({
    summary: 'DRE por competência',
    description: `
Monta a Demonstração do Resultado do Exercício a partir dos LedgerEntries
agrupados por master_account.dre_section.

Parâmetros:
- from/to: range de competências (ex: 2026-01 a 2026-03)
- unit_id: filtra por unidade. Se omitido, consolida todas.
- consolidated: true = soma todas, ignorando unit_id.

Retorna seções ordenadas + resumo com receita_bruta → resultado_líquido.
    `,
  })
  @ApiResponse({
    status: 200, description: 'Relatório DRE',
    schema: {
      example: {
        from: '2026-01', to: '2026-03',
        unit_id: null, consolidated: true,
        generated_at: '2026-02-22T18:00:00.000Z',
        sections: [
          { dre_section: 'RECEITA_BRUTA', nature: 'RECEITA', total: 150000, entries_count: 42 },
          { dre_section: 'DEDUCOES_RECEITA', nature: 'RECEITA', total: 12000, entries_count: 8 },
          { dre_section: 'CUSTO_SERVICO', nature: 'DESPESA', total: 45000, entries_count: 30 },
        ],
        summary: {
          receita_bruta: 150000,
          deducoes: 12000,
          receita_liquida: 138000,
          custos: 45000,
          lucro_bruto: 93000,
          despesas_operacionais: 55000,
          ebitda: 38000,
          depreciacao: 3000,
          resultado_antes_ir: 35000,
          impostos: 5600,
          resultado_liquido: 29400,
        },
      },
    },
  })
  async dreReport(@Query() query: DreReportQueryDto) {
    return this.reports.getDre(
      query.from,
      query.to,
      query.unit_id,
      query.consolidated,
    );
  }

  @Get('reports/cashflow')
  @RequirePermissions(Permission.DRE_READ)
  @ApiOperation({
    summary: 'Fluxo de caixa realizado + projeção',
    description: `
Realizado: CashMovements no período from..to.
Projeção: Payables pendentes (due_date) e Receivables pendentes (expected_date)
nos próximos projection_days após "to".

Retorna:
- daily: array dia a dia com entradas, saídas, saldo e acumulado
- by_account: totais por conta contábil (código mestre)
- Dias projetados marcados com is_projection=true
    `,
  })
  @ApiResponse({
    status: 200, description: 'Relatório de fluxo de caixa',
    schema: {
      example: {
        from: '2026-01-01', to: '2026-01-31',
        unit_id: 'u1u2-...', projection_days: 30,
        generated_at: '2026-02-22T18:00:00.000Z',
        total_in: 95000, total_out: 62000, net_balance: 33000,
        daily: [
          { date: '2026-01-02', entries_in: 8500, entries_out: 1500, balance: 7000, cumulative: 7000, is_projection: false },
          { date: '2026-01-05', entries_in: 0, entries_out: 5000, balance: -5000, cumulative: 2000, is_projection: false },
          { date: '2026-02-15', entries_in: 12000, entries_out: 3000, balance: 9000, cumulative: 42000, is_projection: true },
        ],
        by_account: [
          { account_code: '3.1.01.001', account_name: 'Consultas Particulares', total_in: 35000, total_out: 0 },
          { account_code: '4.5.01', account_name: 'Aluguel', total_in: 0, total_out: 8000 },
        ],
      },
    },
  })
  async cashFlowReport(@Query() query: CashFlowReportQueryDto) {
    return this.reports.getCashFlow(
      query.from,
      query.to,
      query.unit_id,
      query.projection_days ?? 30,
    );
  }
}
