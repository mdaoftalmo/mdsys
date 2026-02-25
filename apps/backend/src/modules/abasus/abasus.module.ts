import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { RepasseController } from './repasse.controller';
import { ProductionService } from './production.service';
import { RepasseService } from './repasse.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({
  imports: [FinanceiroModule, EstoqueModule],
  controllers: [ProductionController, RepasseController],
  providers: [ProductionService, RepasseService],
  exports: [ProductionService, RepasseService],
})
export class AbasusModule {}
