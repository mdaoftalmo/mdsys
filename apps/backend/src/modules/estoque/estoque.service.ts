import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(filters: { category?: string; search?: string }) {
    return this.prisma.stockItem.findMany({
      where: {
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' as any } }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getStockLevels(unitId: string) {
    return this.prisma.stockLevel.findMany({
      where: { unit_id: unitId },
      include: { item: { select: { sku: true, name: true, category: true, min_stock: true, reorder_point: true } } },
      orderBy: { expiry: 'asc' },
    });
  }

  async getCriticalStock(unitId: string) {
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    // Two targeted queries instead of loading all levels + filter in memory
    const [belowReorder, expiring] = await Promise.all([
      // Items below reorder point (using raw where on relation)
      this.prisma.$queryRaw<Array<{
        id: string; quantity: number; lot: string | null; expiry: Date | null;
        unit_cost: number; sku: string; name: string; category: string;
        min_stock: number; reorder_point: number;
      }>>`
        SELECT sl.id, sl.quantity, sl.lot, sl.expiry, sl.unit_cost,
               si.sku, si.name, si.category, si.min_stock, si.reorder_point
        FROM stock_levels sl
        JOIN stock_items si ON si.id = sl.stock_item_id
        WHERE sl.unit_id = ${unitId}
          AND sl.quantity < si.reorder_point
          AND sl.quantity > 0
        ORDER BY sl.quantity ASC
      `,
      // Items expiring within 30 days
      this.prisma.stockLevel.findMany({
        where: {
          unit_id: unitId,
          expiry: { lte: thirtyDays },
          quantity: { gt: 0 },
        },
        include: { item: { select: { sku: true, name: true, category: true, min_stock: true, reorder_point: true } } },
        orderBy: { expiry: 'asc' },
      }),
    ]);

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const results: any[] = [];

    for (const row of belowReorder) {
      seen.add(row.id);
      results.push({
        id: row.id, quantity: row.quantity, lot: row.lot, expiry: row.expiry,
        item: { sku: row.sku, name: row.name, category: row.category, min_stock: row.min_stock, reorder_point: row.reorder_point },
        alert_type: Number(row.quantity) < Number(row.min_stock) ? 'CRITICO' : 'REPOR',
      });
    }

    for (const row of expiring) {
      if (!seen.has(row.id)) {
        results.push({ ...row, alert_type: 'VENCENDO' });
      }
    }

    return results;
  }

  async registerMovement(unitId: string, data: {
    stock_item_id: string; type: string; quantity: number;
    lot?: string; operator_name: string; patient_name?: string;
    patient_cpf?: string; reference?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const isExit = data.type === 'SAIDA';
      const absQty = Math.abs(data.quantity);
      const deltaQty = isExit ? -absQty : absQty;

      // Find or prepare stock level
      const level = await tx.stockLevel.findFirst({
        where: { stock_item_id: data.stock_item_id, unit_id: unitId, lot: data.lot || null },
      });

      // GUARD: prevent negative stock on SAIDA
      if (isExit) {
        const currentQty = level?.quantity ?? 0;
        if (currentQty < absQty) {
          throw new BadRequestException(
            `Estoque insuficiente. Disponível: ${currentQty}, solicitado: ${absQty}`,
          );
        }
      }

      // Create immutable movement
      const movement = await tx.stockMovement.create({
        data: {
          stock_item_id: data.stock_item_id,
          unit_id: unitId,
          type: data.type as any,
          quantity: deltaQty,
          lot: data.lot,
          operator_name: data.operator_name,
          patient_name: data.patient_name,
          patient_cpf: data.patient_cpf,
          reference: data.reference,
        },
      });

      // Update or create stock level
      if (level) {
        await tx.stockLevel.update({
          where: { id: level.id },
          data: { quantity: { increment: deltaQty } },
        });
      } else {
        // New lot/unit combination — fetch item cost for default
        const item = await tx.stockItem.findUniqueOrThrow({
          where: { id: data.stock_item_id },
          select: { cost: true },
        });
        await tx.stockLevel.create({
          data: {
            stock_item_id: data.stock_item_id,
            unit_id: unitId,
            quantity: absQty, // only ENTRADA can reach here (SAIDA throws above)
            lot: data.lot,
            unit_cost: item.cost,
          },
        });
      }

      return movement;
    });
  }

  async getExpiringItems(unitId: string, daysAhead: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.stockLevel.findMany({
      where: {
        unit_id: unitId,
        expiry: { lte: cutoff },
        quantity: { gt: 0 },
      },
      include: { item: { select: { sku: true, name: true, category: true } } },
      orderBy: { expiry: 'asc' },
    });
  }
}
