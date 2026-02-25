import { Module } from '@nestjs/common';
import { FinanceiroController } from './financeiro.controller';
import { EngineController } from './engine.controller';
import { FinanceiroService } from './financeiro.service';
import { LedgerService } from './ledger.service';
import { ReportService } from './report.service';

@Module({
  controllers: [FinanceiroController, EngineController],
  providers: [FinanceiroService, LedgerService, ReportService],
  exports: [FinanceiroService, LedgerService, ReportService],
})
export class FinanceiroModule {}
