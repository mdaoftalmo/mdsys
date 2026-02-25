// ═══════════════════════════════════════════════════════════════
// PARTE C — GUIA DE MIGRAÇÃO
// ═══════════════════════════════════════════════════════════════
//
// PASSO 1: Gerar migration
//   cd apps/backend
//   npx prisma migrate dev --name financial_ledger_model
//
// O Prisma vai:
//   a) DROP table chart_accounts (dados migrados manualmente ANTES)
//   b) CREATE TABLE master_accounts
//   c) CREATE TABLE unit_accounts
//   d) CREATE TABLE ledger_entries
//   e) CREATE TABLE cash_movements
//   f) ALTER TABLE payables: RENAME account_id → unit_account_id, DROP FK para chart_accounts, ADD FK para unit_accounts
//   g) ALTER TABLE receivables: ADD unit_account_id, ADD FK para unit_accounts
//
// PASSO 2: Migração de dados (rodar ANTES do migrate se houver dados em chart_accounts)
//
//   -- 2a. Inserir master_accounts a partir de chart_accounts existentes
//   INSERT INTO master_accounts (id, code, name, nature, dre_section, level, is_group, is_active, is_locked, created_at, updated_at)
//   SELECT id, code, name,
//     CASE type WHEN 'RECEITA' THEN 'RECEITA' WHEN 'DESPESA' THEN 'DESPESA' ELSE 'PATRIMONIO' END,
//     'NAO_DRE',  -- será ajustado pelo seed depois
//     1, false, true, true, now(), now()
//   FROM chart_accounts;
//
//   -- 2b. Criar unit_accounts para cada unit × master_account
//   INSERT INTO unit_accounts (id, unit_id, master_account_id, is_active, created_at, updated_at)
//   SELECT gen_random_uuid(), u.id, ma.id, true, now(), now()
//   FROM units u CROSS JOIN master_accounts ma
//   WHERE ma.is_group = false;
//
//   -- 2c. Migrar FKs do payables
//   UPDATE payables p
//   SET unit_account_id = (
//     SELECT ua.id FROM unit_accounts ua
//     WHERE ua.unit_id = p.unit_id AND ua.master_account_id = p.account_id
//   )
//   WHERE p.account_id IS NOT NULL;
//
// PASSO 3: Seed do Plano Mestre (após migrate)
//   npx prisma db seed
//
// PASSO 4: Gerar client
//   npx prisma generate
//
// ── NOTAS ──
// - Se BD está vazio (dev), rodar migrate + seed é suficiente
// - Se BD tem dados, executar SQL de migração ANTES do prisma migrate
// - O enum AccountType é removido e substituído por AccountNature
// - Não há breaking change no DreLineType existente (continua para outro uso)
