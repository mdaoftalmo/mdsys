import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// INPUT SCHEMAS (validated before sending to Claude)
// ═══════════════════════════════════════════════════════════════

export const FinanceContextSchema = z.object({
  unit_name: z.string(),
  month: z.string(),
  revenue: z.number(),
  expenses: z.number(),
  payables_pending: z.number(),
  receivables_pending: z.number(),
  gloss_total: z.number(),
  gloss_rate_pct: z.number(),
  dre_summary: z.object({
    receita_bruta: z.number(),
    deducoes: z.number(),
    custos_diretos: z.number(),
    despesas_op: z.number(),
    ebitda: z.number(),
  }).optional(),
});

export const SurgicalLeadContextSchema = z.object({
  lead_name: z.string(),
  pathology: z.string(),
  status: z.string(),
  score: z.number(),
  barriers: z.array(z.string()),
  interest: z.string(),
  has_insurance: z.boolean(),
  insurance_name: z.string().optional(),
  days_since_last_contact: z.number(),
  total_contacts: z.number(),
  desired_timeframe: z.string().optional(),
  notes: z.string().optional(),
});

export const ScenarioContextSchema = z.object({
  scenario_type: z.enum(['cost_reduction', 'revenue_growth', 'capacity_planning', 'gloss_reduction']),
  current_metrics: z.record(z.number()),
  proposed_changes: z.array(z.object({
    description: z.string(),
    impact_estimate: z.number().optional(),
  })),
  constraints: z.array(z.string()).optional(),
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT SCHEMAS (validated after Claude responds)
// ═══════════════════════════════════════════════════════════════

const FinanceInsightOutput = z.object({
  summary: z.string(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  insights: z.array(z.object({
    category: z.string(),
    observation: z.string(),
    recommendation: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
  data_quality: z.enum(['complete', 'partial', 'insufficient_data']),
});

const SurgicalNextActionsOutput = z.object({
  recommended_actions: z.array(z.object({
    action: z.string(),
    priority: z.enum(['immediate', 'this_week', 'this_month']),
    reasoning: z.string(),
    script_suggestion: z.string().optional(),
  })),
  conversion_probability: z.enum(['high', 'medium', 'low', 'insufficient_data']),
  barriers_analysis: z.string(),
});

const ScenarioSummaryOutput = z.object({
  analysis: z.string(),
  projected_impact: z.object({
    optimistic: z.record(z.number().or(z.string())),
    realistic: z.record(z.number().or(z.string())),
    pessimistic: z.record(z.number().or(z.string())),
  }).or(z.object({ note: z.literal('insufficient_data') })),
  recommendations: z.array(z.string()),
  risks: z.array(z.string()),
  data_quality: z.enum(['complete', 'partial', 'insufficient_data']),
});

// ═══════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: config.get('ANTHROPIC_API_KEY'),
    });
    this.model = config.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514');
    this.maxTokens = config.get('ANTHROPIC_MAX_TOKENS', 4096);
  }

  // ── /ai/finance-insights ──

  async getFinanceInsights(input: z.infer<typeof FinanceContextSchema>) {
    // Validate input
    const parsed = FinanceContextSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Input inválido', errors: parsed.error.flatten() });
    }

    const prompt = `Você é um analista financeiro de clínicas oftalmológicas no Brasil.
Analise os dados financeiros abaixo e retorne insights acionáveis.

REGRAS ESTRITAS:
- Responda APENAS em JSON válido, sem markdown, sem backticks
- NÃO invente números. Use apenas os dados fornecidos.
- Se faltam dados para uma análise, marque data_quality como "insufficient_data"
- Foque em: fluxo de caixa, glosas, tendências, riscos

DADOS:
${JSON.stringify(parsed.data, null, 2)}

FORMATO DE SAÍDA (JSON exato):
{
  "summary": "Resumo executivo em 2-3 frases",
  "risk_level": "low|medium|high|critical",
  "insights": [{ "category": "", "observation": "", "recommendation": "", "priority": "low|medium|high" }],
  "data_quality": "complete|partial|insufficient_data"
}`;

    const raw = await this.callClaude(prompt);
    return this.parseAndValidate(raw, FinanceInsightOutput, 'finance-insights');
  }

  // ── /ai/surgical-next-actions ──

  async getSurgicalNextActions(input: z.infer<typeof SurgicalLeadContextSchema>) {
    const parsed = SurgicalLeadContextSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Input inválido', errors: parsed.error.flatten() });
    }

    const prompt = `Você é um consultor de orientação cirúrgica oftalmológica.
Analise o perfil do lead abaixo e sugira as próximas ações para converter.

REGRAS ESTRITAS:
- Responda APENAS em JSON válido
- NÃO invente dados sobre o paciente
- Se faltam dados, marque conversion_probability como "insufficient_data"
- Considere: barreiras financeiras, medo, agenda, convênio
- Sugira scripts de abordagem quando relevante

PERFIL DO LEAD:
${JSON.stringify(parsed.data, null, 2)}

FORMATO DE SAÍDA (JSON exato):
{
  "recommended_actions": [{ "action": "", "priority": "immediate|this_week|this_month", "reasoning": "", "script_suggestion": "" }],
  "conversion_probability": "high|medium|low|insufficient_data",
  "barriers_analysis": "Análise das barreiras identificadas"
}`;

    const raw = await this.callClaude(prompt);
    return this.parseAndValidate(raw, SurgicalNextActionsOutput, 'surgical-next-actions');
  }

  // ── /ai/scenario-summary ──

  async getScenarioSummary(input: z.infer<typeof ScenarioContextSchema>) {
    const parsed = ScenarioContextSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Input inválido', errors: parsed.error.flatten() });
    }

    const prompt = `Você é um consultor de gestão hospitalar.
Analise o cenário proposto e projete impactos.

REGRAS ESTRITAS:
- Responda APENAS em JSON válido
- NÃO invente números que não constem nos dados
- Use APENAS as métricas fornecidas para projeções
- Se dados insuficientes, coloque { "note": "insufficient_data" } em projected_impact

CENÁRIO:
${JSON.stringify(parsed.data, null, 2)}

FORMATO DE SAÍDA (JSON exato):
{
  "analysis": "Análise do cenário em 3-5 frases",
  "projected_impact": { "optimistic": {}, "realistic": {}, "pessimistic": {} },
  "recommendations": ["..."],
  "risks": ["..."],
  "data_quality": "complete|partial|insufficient_data"
}`;

    const raw = await this.callClaude(prompt);
    return this.parseAndValidate(raw, ScenarioSummaryOutput, 'scenario-summary');
  }

  // ── Private helpers ──

  private async callClaude(prompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude returned no text content');
      }

      return textBlock.text;
    } catch (error: any) {
      this.logger.error(`Claude API error: ${error.message}`);
      throw new BadRequestException('Erro ao consultar AI. Tente novamente.');
    }
  }

  private parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>, endpoint: string): T {
    // Strip potential markdown fences
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      this.logger.error(`AI ${endpoint}: invalid JSON response: ${raw.substring(0, 200)}`);
      throw new BadRequestException('AI retornou formato inválido. Tente novamente.');
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      this.logger.error(`AI ${endpoint}: schema validation failed: ${JSON.stringify(result.error.flatten())}`);
      throw new BadRequestException('AI retornou dados com formato inesperado.');
    }

    return result.data;
  }
}
