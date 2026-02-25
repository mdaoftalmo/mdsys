import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { OrientacaoCirurgicaService } from '../modules/orientacao-cirurgica/orientacao-cirurgica.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowUpCron {
  private readonly logger = new Logger(FollowUpCron.name);

  constructor(
    private readonly surgicalService: OrientacaoCirurgicaService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * CRON: Follow-up 90 dias — roda diariamente às 08:00
   *
   * Regras:
   * 1. Leads sem contato há 7+ dias → marcar como "atrasado"
   * 2. Leads sem contato há 30+ dias → enviar alerta ao responsável
   * 3. Leads sem contato há 90+ dias → mover para PERDIDO automaticamente
   * 4. Leads com next_followup vencido → gerar notificação
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleFollowUpCheck() {
    if (this.config.get('CRON_FOLLOWUP_ENABLED') === 'false') {
      this.logger.debug('Follow-up CRON disabled');
      return;
    }

    this.logger.log('🕐 Iniciando verificação de follow-ups...');
    const now = new Date();

    try {
      // ── 1. Leads sem contato há 90+ dias → auto-PERDIDO ──
      const cutoff90 = new Date(now);
      cutoff90.setDate(cutoff90.getDate() - 90);

      const abandoned = await this.prisma.surgicalLead.findMany({
        where: {
          status: { notIn: ['FECHOU', 'PERDIDO'] },
          OR: [
            { last_contact_at: { lte: cutoff90 } },
            { last_contact_at: null, created_at: { lte: cutoff90 } },
          ],
        },
        select: { id: true, name: true, unit_id: true, last_contact_at: true },
      });

      if (abandoned.length > 0) {
        await this.prisma.surgicalLead.updateMany({
          where: { id: { in: abandoned.map((l) => l.id) } },
          data: {
            status: 'PERDIDO',
            lost_reason: 'Sem contato há 90+ dias (automático)',
          },
        });
        this.logger.warn(
          `⚠️ ${abandoned.length} leads movidos para PERDIDO (90+ dias sem contato)`,
        );
      }

      // ── 2. Follow-ups vencidos hoje ──
      const overdueToday = await this.surgicalService.getOverdueFollowups(0);
      if (overdueToday.length > 0) {
        this.logger.log(
          `📞 ${overdueToday.length} leads com follow-up pendente hoje:`,
        );
        for (const lead of overdueToday.slice(0, 10)) {
          this.logger.log(
            `   → ${lead.name} (${lead.pathology}) | Score: ${lead.score} | ${lead.unit.name}`,
          );
        }
      }

      // ── 3. Leads sem contato há 7-30 dias ──
      const cutoff7 = new Date(now);
      cutoff7.setDate(cutoff7.getDate() - 7);

      const stale = await this.prisma.surgicalLead.count({
        where: {
          status: { notIn: ['FECHOU', 'PERDIDO'] },
          last_contact_at: { lte: cutoff7, gt: cutoff90 },
        },
      });

      if (stale > 0) {
        this.logger.warn(`📋 ${stale} leads sem contato há 7+ dias`);
      }

      // ── Summary ──
      this.logger.log(
        `✅ Follow-up check completo: ${abandoned.length} auto-perdidos, ` +
        `${overdueToday.length} follow-ups hoje, ${stale} sem contato 7+ dias`,
      );
    } catch (error) {
      this.logger.error(`❌ Erro no CRON follow-up: ${error.message}`, error.stack);
    }
  }

  /**
   * CRON: Repasse check — roda a cada 1h
   * Verifica receivables liquidados e libera repasses bloqueados.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleRepasseCheck() {
    if (this.config.get('CRON_REPASSE_ENABLED') === 'false') return;

    try {
      // Find BLOQUEADO repasse transactions whose receivables are now RECEBIDO
      const toRelease = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT rt.id
        FROM repasse_transactions rt
        JOIN receivables r ON r.id = rt.receivable_id
        WHERE rt.status = 'BLOQUEADO'
          AND r.status = 'RECEBIDO'
      `;

      if (toRelease.length > 0) {
        await this.prisma.repasseTransaction.updateMany({
          where: { id: { in: toRelease.map((r) => r.id) } },
          data: { status: 'LIBERADO', released_at: new Date() },
        });
        this.logger.log(`💰 ${toRelease.length} repasses liberados`);
      }
    } catch (error) {
      this.logger.error(`❌ Erro no CRON repasse: ${error.message}`);
    }
  }
}
