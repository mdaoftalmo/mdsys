# ORIENTAÇÃO CIRÚRGICA — Mapeamento de Endpoints

## Endpoints Existentes no Backend (usados pelo frontend)

| Método | Rota                                    | Usado em           | Descrição                          |
|--------|-----------------------------------------|---------------------|------------------------------------|
| GET    | `/orientacao-cirurgica/kanban`           | Board (page.tsx)    | Dados agrupados por status         |
| GET    | `/orientacao-cirurgica`                  | Fila do Dia, Patol. | Lista com filtros + paginação      |
| GET    | `/orientacao-cirurgica/:id`             | LeadDrawer          | Detalhe do lead com contacts[]     |
| POST   | `/orientacao-cirurgica`                 | NewLeadModal        | Criar novo lead                    |
| PATCH  | `/orientacao-cirurgica/:id`             | LeadDrawer (editar) | Atualizar dados do lead            |
| PATCH  | `/orientacao-cirurgica/:id/status`      | LeadDrawer, Board   | Mudar status (drag / dropdown)     |
| POST   | `/orientacao-cirurgica/:id/contacts`    | ContactModal        | Registrar contato/follow-up        |
| PATCH  | `/orientacao-cirurgica/:id/followup`    | LeadDrawer, Fila    | Agendar próximo follow-up          |
| GET    | `/orientacao-cirurgica/funnel`          | (reservado para BI) | Estatísticas do funil              |

Todos usam `?unit_id=` como query param (resolvido pelo UnitScopeGuard).

## Endpoints FALTANTES (precisam ser criados)

### 1. `GET /orientacao-cirurgica/overdue-count`

**Usado em:** layout.tsx (badge da tab "Fila do Dia")

**Retorno esperado:**
```json
{ "count": 7 }
```

**Lógica:** Contar leads onde:
- `status NOT IN ('FECHOU', 'PERDIDO')`
- E (`last_contact_at` > 30 dias OU `next_followup` vencido OU `next_followup` = hoje)

**Implementação sugerida no service:**
```typescript
async getOverdueCount(unitId: string): Promise<{ count: number }> {
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const count = await this.prisma.surgicalLead.count({
    where: {
      unit_id: unitId,
      status: { notIn: ['FECHOU', 'PERDIDO'] },
      OR: [
        { last_contact_at: { lte: cutoff30 } },
        { last_contact_at: null },
        { next_followup: { lte: today } },
      ],
    },
  });

  return { count };
}
```

### 2. Filtro `status_not` no `findAll`

**Usado em:** Fila do Dia — `GET /orientacao-cirurgica?status_not=FECHOU,PERDIDO`

**Status:** O `LeadFilterDto` atual suporta `status` (single) mas não `status_not`.

**Fix sugerido:** Adicionar ao `LeadFilterDto`:
```typescript
@IsOptional()
@IsString()
status_not?: string; // comma-separated: "FECHOU,PERDIDO"
```

No service `findAll`:
```typescript
if (filters.status_not) {
  const excluded = filters.status_not.split(',');
  where.status = { notIn: excluded };
}
```

### 3. `contacts[]` incluído no `findAll`

**Status:** O `findAll` atual retorna leads mas pode não incluir `contacts` no include.

**Fix:** Adicionar ao findAll query:
```typescript
include: {
  contacts: { orderBy: { date: 'desc' }, take: 3 },
  unit: { select: { name: true } },
}
```

## Parâmetros de Query usados pelo Frontend

| Parâmetro     | Tipo    | Usado em        | Descrição                                      |
|---------------|---------|-----------------|-------------------------------------------------|
| `unit_id`     | string  | Todos           | Obrigatório para scoping                        |
| `status`      | string  | Board (futuro)  | Filtrar por status específico                   |
| `status_not`  | string  | Fila do Dia     | Excluir status (comma-separated) **[FALTANTE]** |
| `pathology`   | string  | Board (filtro)  | Filtrar por patologia                           |
| `limit`       | number  | Fila, Patol.    | Paginação (default 50, usamos 500 para listas)  |
| `page`        | number  | (futuro)        | Página                                          |

## Formato de Response esperado pelo Frontend

### `GET /orientacao-cirurgica/kanban`
```typescript
{
  columns: {
    PRIMEIRA: SurgicalLead[],
    PROPENSO: SurgicalLead[],
    // ... cada status
  },
  stats: {
    total: number,
    fechou: number,
    perdido: number,
    em_pipeline: number,
    conversion_rate_pct: number,
  }
}
```

### `GET /orientacao-cirurgica` (list)
```typescript
{
  data: SurgicalLead[],
  total: number,
  page: number,
  limit: number,
}
```

### SurgicalLead (shape completo)
```typescript
{
  id: string;
  unit_id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  pathology: string;
  procedure?: string;
  eye?: string;
  status: LeadStatus;
  score: number;
  interest?: string;
  barriers: string[];
  has_insurance: boolean;
  insurance_name?: string;
  desired_timeframe?: string;
  lost_reason?: string;
  notes?: string;
  responsavel?: string;
  indication_date?: string;
  last_contact_at?: string;
  next_followup?: string;
  contacts: LeadContact[];
  unit: { name: string };
}
```
