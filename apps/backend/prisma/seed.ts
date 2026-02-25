// apps/backend/prisma/seed.ts
// ═══════════════════════════════════════════════════════════════
// Seed completo: modo demo com dados realistas para oftalmologia
// Roda via: npx prisma db seed  (ou RUN_SEED=true no deploy)
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

interface MASeed { code: string; name: string; nature: 'RECEITA'|'DESPESA'|'PATRIMONIO'; dre: string; level: number; group: boolean; parent?: string; }

async function main() {
  console.log('🌱 Seeding ERP MDV...');

  // ══════════════════════════════════════════════
  // 1. UNITS (5 unidades)
  // ══════════════════════════════════════════════
  const units = await Promise.all([
    prisma.unit.upsert({ where: { cnpj: '12.345.678/0001-01' }, update: {}, create: { name: 'São Camilo', cnpj: '12.345.678/0001-01', city: 'São Paulo', cnes: '2345678', tax_regime: 'LUCRO_PRESUMIDO' } }),
    prisma.unit.upsert({ where: { cnpj: '12.345.678/0002-02' }, update: {}, create: { name: 'Santa Casa', cnpj: '12.345.678/0002-02', city: 'São Paulo', cnes: '3456789', tax_regime: 'LUCRO_PRESUMIDO' } }),
    prisma.unit.upsert({ where: { cnpj: '12.345.678/0003-03' }, update: {}, create: { name: 'SUS – Campinas', cnpj: '12.345.678/0003-03', city: 'Campinas', cnes: '4567890', tax_regime: 'SIMPLES_NACIONAL' } }),
    prisma.unit.upsert({ where: { cnpj: '12.345.678/0004-04' }, update: {}, create: { name: 'CME', cnpj: '12.345.678/0004-04', city: 'Castro', cnes: '5678901', tax_regime: 'SIMPLES_NACIONAL' } }),
    prisma.unit.upsert({ where: { cnpj: '12.345.678/0005-05' }, update: {}, create: { name: 'Clínica Central', cnpj: '12.345.678/0005-05', city: 'Curitiba', cnes: '6789012', tax_regime: 'LUCRO_PRESUMIDO' } }),
  ]);
  console.log(`✅ ${units.length} units`);

  // ══════════════════════════════════════════════
  // 2. USERS (3 perfis)
  // ══════════════════════════════════════════════
  const hash = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || 'mdv@2026!', 12);
  const users = await Promise.all([
    prisma.systemUser.upsert({ where: { login: 'admin' }, update: {}, create: { name: 'Administrador', login: 'admin', password_hash: hash, access_level: 'FULL', unit_id: null } }),
    prisma.systemUser.upsert({ where: { login: 'financeiro' }, update: {}, create: { name: 'Ana Financeiro', login: 'financeiro', password_hash: hash, access_level: 'FINANCEIRO', unit_id: null } }),
    prisma.systemUser.upsert({ where: { login: 'secretaria.sc' }, update: {}, create: { name: 'Maria Secretária', login: 'secretaria.sc', password_hash: hash, access_level: 'SECRETARIA', unit_id: units[0].id } }),
  ]);
  console.log(`✅ ${users.length} users`);

  // ══════════════════════════════════════════════
  // 3. MASTER ACCOUNTS (plano de contas oftalmologia)
  // ══════════════════════════════════════════════
  const accounts: MASeed[] = [
    // RECEITAS (3.x)
    { code: '3', name: 'RECEITAS', nature: 'RECEITA', dre: 'NAO_DRE', level: 1, group: true },
    { code: '3.1', name: 'Receita Operacional', nature: 'RECEITA', dre: 'NAO_DRE', level: 2, group: true, parent: '3' },
    { code: '3.1.01', name: 'Consultas', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 3, group: true, parent: '3.1' },
    { code: '3.1.01.001', name: 'Consultas Particulares', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.01' },
    { code: '3.1.01.002', name: 'Consultas Convênio', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.01' },
    { code: '3.1.02', name: 'Exames', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 3, group: true, parent: '3.1' },
    { code: '3.1.02.001', name: 'Exames OCT/Retinografia', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.02' },
    { code: '3.1.03', name: 'Cirurgias', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 3, group: true, parent: '3.1' },
    { code: '3.1.03.001', name: 'Cirurgias Particulares', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.03' },
    { code: '3.1.03.002', name: 'Cirurgias Convênio', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.03' },
    { code: '3.1.03.003', name: 'Cirurgias SUS', nature: 'RECEITA', dre: 'RECEITA_BRUTA', level: 4, group: false, parent: '3.1.03' },
    { code: '3.2', name: 'Deduções da Receita', nature: 'RECEITA', dre: 'DEDUCOES_RECEITA', level: 2, group: true, parent: '3' },
    { code: '3.2.01', name: 'Impostos sobre Receita', nature: 'RECEITA', dre: 'DEDUCOES_RECEITA', level: 3, group: false, parent: '3.2' },
    { code: '3.3', name: 'Receitas Financeiras', nature: 'RECEITA', dre: 'RECEITA_FINANCEIRA', level: 2, group: true, parent: '3' },
    { code: '3.3.01', name: 'Rendimentos Aplicações', nature: 'RECEITA', dre: 'RECEITA_FINANCEIRA', level: 3, group: false, parent: '3.3' },

    // DESPESAS (4.x)
    { code: '4', name: 'DESPESAS', nature: 'DESPESA', dre: 'NAO_DRE', level: 1, group: true },
    { code: '4.1', name: 'Custos dos Serviços', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 2, group: true, parent: '4' },
    { code: '4.1.01', name: 'Material Cirúrgico', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 3, group: true, parent: '4.1' },
    { code: '4.1.01.001', name: 'LIOs (Lentes Intraoculares)', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 4, group: false, parent: '4.1.01' },
    { code: '4.1.01.002', name: 'Gases/Óleos Retina', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 4, group: false, parent: '4.1.01' },
    { code: '4.1.01.003', name: 'Anti-VEGF (Avastin/Lucentis)', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 4, group: false, parent: '4.1.01' },
    { code: '4.1.02', name: 'Medicamentos', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 3, group: false, parent: '4.1' },
    { code: '4.1.03', name: 'Honorários Médicos', nature: 'DESPESA', dre: 'CUSTO_SERVICO', level: 3, group: false, parent: '4.1' },
    { code: '4.2', name: 'Despesas com Pessoal', nature: 'DESPESA', dre: 'DESPESA_PESSOAL', level: 2, group: true, parent: '4' },
    { code: '4.2.01', name: 'Salários e Encargos', nature: 'DESPESA', dre: 'DESPESA_PESSOAL', level: 3, group: false, parent: '4.2' },
    { code: '4.2.02', name: 'Benefícios (VR/VT/Plano)', nature: 'DESPESA', dre: 'DESPESA_PESSOAL', level: 3, group: false, parent: '4.2' },
    { code: '4.3', name: 'Despesas Administrativas', nature: 'DESPESA', dre: 'DESPESA_ADMINISTRATIVA', level: 2, group: true, parent: '4' },
    { code: '4.3.01', name: 'Material de Escritório', nature: 'DESPESA', dre: 'DESPESA_ADMINISTRATIVA', level: 3, group: false, parent: '4.3' },
    { code: '4.3.02', name: 'Software e TI', nature: 'DESPESA', dre: 'DESPESA_ADMINISTRATIVA', level: 3, group: false, parent: '4.3' },
    { code: '4.4', name: 'Despesas Comerciais', nature: 'DESPESA', dre: 'DESPESA_COMERCIAL', level: 2, group: true, parent: '4' },
    { code: '4.4.01', name: 'Marketing e Publicidade', nature: 'DESPESA', dre: 'DESPESA_COMERCIAL', level: 3, group: false, parent: '4.4' },
    { code: '4.5', name: 'Despesas de Ocupação', nature: 'DESPESA', dre: 'DESPESA_OCUPACAO', level: 2, group: true, parent: '4' },
    { code: '4.5.01', name: 'Aluguel', nature: 'DESPESA', dre: 'DESPESA_OCUPACAO', level: 3, group: false, parent: '4.5' },
    { code: '4.5.02', name: 'Energia/Água/Internet', nature: 'DESPESA', dre: 'DESPESA_OCUPACAO', level: 3, group: false, parent: '4.5' },
    { code: '4.6', name: 'Despesas Financeiras', nature: 'DESPESA', dre: 'DESPESA_FINANCEIRA', level: 2, group: true, parent: '4' },
    { code: '4.6.01', name: 'Juros e Multas', nature: 'DESPESA', dre: 'DESPESA_FINANCEIRA', level: 3, group: false, parent: '4.6' },
    { code: '4.6.02', name: 'Taxas Bancárias', nature: 'DESPESA', dre: 'DESPESA_FINANCEIRA', level: 3, group: false, parent: '4.6' },
    { code: '4.7', name: 'Depreciação e Amortização', nature: 'DESPESA', dre: 'DEPRECIACAO_AMORTIZACAO', level: 2, group: true, parent: '4' },
    { code: '4.7.01', name: 'Deprec. Equipamentos', nature: 'DESPESA', dre: 'DEPRECIACAO_AMORTIZACAO', level: 3, group: false, parent: '4.7' },
    { code: '4.8', name: 'Impostos sobre Resultado', nature: 'DESPESA', dre: 'IMPOSTOS_RESULTADO', level: 2, group: true, parent: '4' },
    { code: '4.8.01', name: 'IRPJ/CSLL', nature: 'DESPESA', dre: 'IMPOSTOS_RESULTADO', level: 3, group: false, parent: '4.8' },
  ];

  // Resolve parent_ids
  const codeToId: Record<string, string> = {};
  for (const a of accounts) {
    const parentId = a.parent ? codeToId[a.parent] : null;
    const ma = await prisma.masterAccount.upsert({
      where: { code: a.code },
      update: {},
      create: {
        code: a.code, name: a.name, nature: a.nature as any,
        dre_section: a.dre as any, level: a.level,
        is_group: a.group, parent_id: parentId, is_locked: true,
      },
    });
    codeToId[a.code] = ma.id;
  }
  console.log(`✅ ${accounts.length} master accounts`);

  // ══════════════════════════════════════════════
  // 4. UNIT ACCOUNTS (analytic accounts × units)
  // ══════════════════════════════════════════════
  const analyticAccounts = accounts.filter(a => !a.group);
  let uaCount = 0;
  for (const unit of units) {
    for (const a of analyticAccounts) {
      await prisma.unitAccount.upsert({
        where: { uq_unit_master: { unit_id: unit.id, master_account_id: codeToId[a.code] } },
        update: {},
        create: { unit_id: unit.id, master_account_id: codeToId[a.code] },
      });
      uaCount++;
    }
  }
  console.log(`✅ ${uaCount} unit accounts`);

  // ══════════════════════════════════════════════
  // 5. SUPPLIERS
  // ══════════════════════════════════════════════
  const suppliers = await Promise.all([
    prisma.supplier.upsert({ where: { cnpj: '11.111.111/0001-11' }, update: {}, create: { name: 'Alcon Brasil', cnpj: '11.111.111/0001-11', category: 'Insumos Médicos', contact_name: 'Carlos', contact_phone: '(11) 3333-0001' } }),
    prisma.supplier.upsert({ where: { cnpj: '22.222.222/0001-22' }, update: {}, create: { name: 'Zeiss Medical', cnpj: '22.222.222/0001-22', category: 'Equipamentos', contact_name: 'Paula', contact_phone: '(11) 3333-0002' } }),
    prisma.supplier.upsert({ where: { cnpj: '33.333.333/0001-33' }, update: {}, create: { name: 'Farmácia Hospitalar', cnpj: '33.333.333/0001-33', category: 'Farmácia', contact_name: 'Roberto', contact_phone: '(11) 3333-0003' } }),
  ]);
  console.log(`✅ ${suppliers.length} suppliers`);

  // ══════════════════════════════════════════════
  // 6. BANK ACCOUNTS
  // ══════════════════════════════════════════════
  const bank = await prisma.bankAccount.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', unit_id: units[0].id, bank_name: 'Bradesco', bank_code: '237', agency: '1234', account_number: '56789-0', is_main: true },
  });
  console.log('✅ bank account');

  // ══════════════════════════════════════════════
  // 7. DEMO PAYABLES (5 por unidade[0])
  // ══════════════════════════════════════════════
  const u0 = units[0].id;
  const u2 = units[2].id; // SUS – Campinas
  const uaLio = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '4.1.01.001' } } });
  const uaMed = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '4.1.02' } } });
  const uaAluguel = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '4.5.01' } } });
  const uaEnergia = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '4.5.02' } } });
  const uaSoftware = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '4.3.02' } } });

  const payablesData = [
    { description: 'LIOs Alcon AcrySof - Lote Jan', supplier_id: suppliers[0].id, unit_account_id: uaLio?.id, value: 18500, due: '2026-01-25', comp: '2026-01', status: 'APROVADO' },
    { description: 'Medicamentos oftálmicos mensal', supplier_id: suppliers[2].id, unit_account_id: uaMed?.id, value: 4200, due: '2026-01-30', comp: '2026-01', status: 'PENDENTE' },
    { description: 'Aluguel sala cirúrgica São Camilo', supplier_id: suppliers[0].id, unit_account_id: uaAluguel?.id, value: 12000, due: '2026-02-05', comp: '2026-02', status: 'APROVADO' },
    { description: 'Conta de energia Jan', supplier_id: suppliers[2].id, unit_account_id: uaEnergia?.id, value: 3800, due: '2026-02-10', comp: '2026-01', status: 'PENDENTE' },
    { description: 'Software prontuário (anual)', supplier_id: suppliers[1].id, unit_account_id: uaSoftware?.id, value: 9600, due: '2026-03-01', comp: '2026-01', status: 'PAGO' },
  ];

  for (const p of payablesData) {
    await prisma.payable.create({
      data: {
        unit_id: u0, description: p.description, supplier_id: p.supplier_id,
        unit_account_id: p.unit_account_id || null, cost_center_id: null,
        competence: p.comp, due_date: new Date(p.due), value: p.value,
        payment_method: 'BOLETO', status: p.status as any,
      },
    });
  }
  console.log(`✅ ${payablesData.length} payables`);

  // ══════════════════════════════════════════════
  // 8. DEMO RECEIVABLES (5 por unidade[0])
  // ══════════════════════════════════════════════
  const uaConsultPart = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '3.1.01.001' } } });
  const uaConsultConv = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '3.1.01.002' } } });
  const uaCirPart = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '3.1.03.001' } } });
  const uaCirConv = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '3.1.03.002' } } });
  const uaExame = await prisma.unitAccount.findFirst({ where: { unit_id: u0, master_account: { code: '3.1.02.001' } } });

  const receivablesData = [
    { source: 'Consultas Particulares Jan', unit_account_id: uaConsultPart?.id, gross: 28000, net: 28000, comp: '2026-01', date: '2026-02-15', status: 'PREVISTO' },
    { source: 'Convênio Unimed – lote Jan', unit_account_id: uaConsultConv?.id, gross: 45000, net: 38500, comp: '2026-01', date: '2026-02-28', status: 'PREVISTO' },
    { source: 'Cirurgias Particulares Jan', unit_account_id: uaCirPart?.id, gross: 65000, net: 65000, comp: '2026-01', date: '2026-02-10', status: 'RECEBIDO' },
    { source: 'Cirurgias Convênio Jan', unit_account_id: uaCirConv?.id, gross: 42000, net: 35700, comp: '2026-01', date: '2026-03-15', status: 'PREVISTO' },
    { source: 'Exames OCT/Retinografia Jan', unit_account_id: uaExame?.id, gross: 18500, net: 18500, comp: '2026-01', date: '2026-02-20', status: 'PREVISTO' },
  ];

  for (const r of receivablesData) {
    await prisma.receivable.create({
      data: {
        unit_id: u0, source: r.source, unit_account_id: r.unit_account_id || null,
        competence: r.comp, expected_date: new Date(r.date),
        gross_value: r.gross, discount: 0, net_value: r.net,
        gloss_value: r.gross - r.net, is_convenio: r.net < r.gross,
        status: r.status as any,
      },
    });
  }
  console.log(`✅ ${receivablesData.length} receivables`);

  // ══════════════════════════════════════════════
  // 9. DEMO SURGICAL LEADS (5 leads)
  // ══════════════════════════════════════════════
  const leadsData = [
    { name: 'Maria Aparecida Santos', phone: '(11) 99881-1234', pathology: 'Catarata', eye: 'OD', status: 'PRIMEIRA', score: 75 },
    { name: 'José Carlos Ferreira', phone: '(11) 99882-5678', pathology: 'Catarata Bilateral', eye: 'AO', status: 'RETORNO', score: 90 },
    { name: 'Ana Paula Oliveira', phone: '(11) 99883-9012', pathology: 'Pterígio', eye: 'OE', status: 'EXAMES', score: 60 },
    { name: 'Roberto Almeida', phone: '(11) 99884-3456', pathology: 'Glaucoma', eye: 'OD', status: 'ORCAMENTO', score: 85 },
    { name: 'Francisca Lima', phone: '(11) 99885-7890', pathology: 'Descolamento Retina', eye: 'OD', status: 'FECHOU', score: 95 },
  ];

  for (const l of leadsData) {
    await prisma.surgicalLead.create({
      data: {
        unit_id: u0, name: l.name, phone: l.phone, pathology: l.pathology,
        eye: l.eye as any, status: l.status as any, score: l.score,
        next_followup: l.status !== 'FECHOU' ? new Date(Date.now() + 3 * 86400000) : null,
      },
    });
  }
  console.log(`✅ ${leadsData.length} surgical leads`);

  // ══════════════════════════════════════════════
  // 9b. DEMO PATIENTS (6 pacientes)
  // ══════════════════════════════════════════════
  const patientsData = [
    { name: 'Maria Aparecida Santos', cpf: '111.222.333-44', dob: '1965-03-15', phone: '(11) 99881-1234', email: 'maria.santos@email.com', address: 'Rua das Flores, 123 - São Paulo/SP', source_channel: 'Indicação médico', notes: 'Paciente diabética tipo 2. Acompanhar glicemia pré-cirurgia.' },
    { name: 'José Carlos Ferreira', cpf: '222.333.444-55', dob: '1958-07-22', phone: '(11) 99882-5678', email: null, address: 'Av. Paulista, 1000 - São Paulo/SP', source_channel: 'Google', notes: 'Hipertenso controlado.' },
    { name: 'Ana Paula Oliveira', cpf: '333.444.555-66', dob: '1980-11-03', phone: '(11) 99883-9012', email: 'ana.oliveira@gmail.com', address: null, source_channel: 'Instagram', notes: null },
    { name: 'Roberto Almeida Silva', cpf: '444.555.666-77', dob: '1972-01-30', phone: '(11) 99884-3456', email: 'roberto.almeida@empresa.com', address: 'Rua Augusta, 500 - São Paulo/SP', source_channel: 'Indicação paciente', notes: 'Alérgico a dipirona.' },
    { name: 'Francisca Lima Souza', cpf: '555.666.777-88', dob: '1945-05-18', phone: '(11) 99885-7890', email: null, address: 'Rua Consolação, 200 - São Paulo/SP', source_channel: 'Convenio', notes: 'Paciente idosa, acompanhante obrigatório.' },
    { name: 'Lucas Gabriel Costa', cpf: '666.777.888-99', dob: '1995-09-10', phone: '(11) 99886-2345', email: 'lucas.costa@gmail.com', address: null, source_channel: null, notes: null },
  ];

  for (const p of patientsData) {
    await prisma.patient.upsert({
      where: { cpf: p.cpf },
      update: {},
      create: {
        name: p.name, cpf: p.cpf, dob: new Date(p.dob),
        phone: p.phone, email: p.email, address: p.address,
        source_channel: (p as any).source_channel ?? null,
        notes: p.notes, origin_unit_id: u0,
      },
    });
  }
  console.log(`✅ ${patientsData.length} patients`);

  // ══════════════════════════════════════════════
  // 9c. SERVICE CATALOG (6 serviços oftalmológicos)
  // ══════════════════════════════════════════════
  const servicesData = [
    { name: 'Consulta Oftalmológica', category: 'Consulta', price_particular: 350, price_card: 300, tuss_code: '10101012' },
    { name: 'Retorno (até 30 dias)', category: 'Consulta', price_particular: 0, price_card: 0, tuss_code: '10101039' },
    { name: 'OCT - Tomografia Coerência Óptica', category: 'Exame', price_particular: 280, price_card: 250, tuss_code: '40904030' },
    { name: 'Retinografia Colorida', category: 'Exame', price_particular: 180, price_card: 160, tuss_code: '40904080' },
    { name: 'Campimetria Computadorizada', category: 'Exame', price_particular: 220, price_card: 200, tuss_code: '40904048' },
    { name: 'Facoemulsificação (Catarata)', category: 'Cirurgia', price_particular: 8500, price_card: 8000, tuss_code: '30401034' },
  ];

  for (const s of servicesData) {
    const existing = await prisma.serviceCatalog.findFirst({ where: { tuss_code: s.tuss_code } });
    if (!existing) {
      await prisma.serviceCatalog.create({
        data: { name: s.name, category: s.category, price_particular: s.price_particular, price_card: s.price_card, tuss_code: s.tuss_code },
      });
    }
  }
  console.log(`✅ ${servicesData.length} services`);

  // ══════════════════════════════════════════════
  // 9d. CONVENIOS (3 convênios)
  // ══════════════════════════════════════════════
  const conveniosData = [
    { name: 'PAS São Camilo', slug: 'pas_sao_camilo', registro_ans: '312100', color: '#3b82f6' },
    { name: 'Sul América Saúde', slug: 'sul_america', registro_ans: '006246', color: '#10b981' },
    { name: 'Unimed Campinas', slug: 'unimed_campinas', registro_ans: '321729', color: '#f59e0b' },
  ];

  for (const c of conveniosData) {
    await prisma.convenio.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, registro_ans: c.registro_ans, color: c.color },
    });
  }
  console.log(`✅ ${conveniosData.length} convenios`);

  // ══════════════════════════════════════════════
  // 10. DEMO EMPLOYEES (3)
  // ══════════════════════════════════════════════
  const emps = [
    { name: 'Dr. Eduardo Martins', role: 'Médico Oftalmologista', crm: 'CRM-SP 123456' },
    { name: 'Enf. Carla Souza', role: 'Enfermeira Instrumentadora', crm: null },
    { name: 'Tec. Lucas Silva', role: 'Técnico em Optometria', crm: null },
  ];
  for (const e of emps) {
    await prisma.employee.upsert({
      where: { cpf: `000.000.000-${emps.indexOf(e) + 10}` },
      update: {},
      create: {
        unit_id: u0, name: e.name, cpf: `000.000.000-${emps.indexOf(e) + 10}`,
        role: e.role, status: 'ATIVO', hire_date: new Date('2024-01-15'),
        salary: e.crm ? 25000 : 4500,
      },
    });
  }
  console.log(`✅ ${emps.length} employees`);

  // ══════════════════════════════════════════════
  // 11. STOCK ITEMS + LEVELS
  // ══════════════════════════════════════════════
  const stockItems = [
    { name: 'LIO AcrySof IQ', sku: 'LIO-001', min: 10, max: 50, cost: 850, category: 'LIO' },
    { name: 'Colírio Moxifloxacino', sku: 'COL-001', min: 20, max: 100, cost: 25, category: 'Medicamento' },
    { name: 'Luva Cirúrgica Estéril', sku: 'LUV-001', min: 50, max: 200, cost: 3, category: 'Descartável' },
    { name: 'Avastin (Bevacizumabe)', sku: 'AVA-001', min: 5, max: 30, cost: 180, category: 'Anti-VEGF' },
    { name: 'Óleo de Silicone 5000cs', sku: 'OLE-001', min: 3, max: 15, cost: 450, category: 'Retina' },
    { name: 'Kit Vitrectomia', sku: 'VIT-001', min: 5, max: 20, cost: 1200, category: 'Retina' },
  ];
  for (const s of stockItems) {
    const item = await prisma.stockItem.upsert({
      where: { sku: s.sku }, update: {},
      create: { name: s.name, sku: s.sku, min_stock: s.min, reorder_point: s.max, cost: s.cost ?? 100, unit_measure: 'UN', category: s.category ?? 'Geral' },
    });
    const existingLevel = await prisma.stockLevel.findFirst({
      where: { stock_item_id: item.id, unit_id: u0 },
    });
    if (!existingLevel) {
      await prisma.stockLevel.create({
        data: { stock_item_id: item.id, unit_id: u0, quantity: Math.floor(s.min * 1.5), lot: 'L2026-01', expiry: new Date('2027-06-30'), unit_cost: s.cost ?? 100 },
      });
    }
    // Also create levels for SUS unit
    const existingSusLevel = await prisma.stockLevel.findFirst({
      where: { stock_item_id: item.id, unit_id: u2 },
    });
    if (!existingSusLevel) {
      await prisma.stockLevel.create({
        data: { stock_item_id: item.id, unit_id: u2, quantity: Math.floor(s.min * 2), lot: 'L2026-01', expiry: new Date('2027-06-30'), unit_cost: s.cost ?? 100 },
      });
    }
  }
  console.log(`✅ ${stockItems.length} stock items with levels`);

  // ══════════════════════════════════════════════
  // 12. ABASUS: SUS REPASSE RULES (new model)
  // ══════════════════════════════════════════════
  const susRepasseRulesData = [
    { procedure_key: 'CONSULTA', role: 'DOCTOR', unit_value: 15, description: 'R$15 por paciente atendido' },
    { procedure_key: 'CONSULTA', role: 'SECRETARY', unit_value: 3, description: 'R$3 por paciente (secretária)' },
    { procedure_key: 'EXAME', role: 'DOCTOR', unit_value: 20, description: 'R$20 por exame (genérico)' },
    { procedure_key: 'EXAME:OCT', role: 'DOCTOR', unit_value: 25, description: 'R$25 por OCT' },
    { procedure_key: 'CIRURGIA:CATARATA', role: 'DOCTOR', unit_value: 350, description: 'R$350 por catarata' },
    { procedure_key: 'CIRURGIA:RETINA', role: 'DOCTOR', unit_value: 500, description: 'R$500 por vitrectomia' },
    { procedure_key: 'CIRURGIA:PTERIGIO', role: 'DOCTOR', unit_value: 200, description: 'R$200 por pterígio' },
    { procedure_key: 'CIRURGIA:ANTI_VEGF', role: 'DOCTOR', unit_value: 120, description: 'R$120 por injeção' },
  ];
  for (const r of susRepasseRulesData) {
    const existing = await prisma.susRepasseRule.findFirst({
      where: { unit_id: u2, procedure_key: r.procedure_key, role: r.role },
    });
    if (!existing) {
      await prisma.susRepasseRule.create({
        data: { unit_id: u2, ...r, valid_from: new Date('2026-01-01') },
      });
    }
  }
  console.log(`✅ ${susRepasseRulesData.length} SUS repasse rules`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
