-- =========================================================
-- Migration 093: Sincronização bidirecional com CRM — log de envios
-- =========================================================
-- A integração com CRM passa a ESCREVER no CRM externo (Sistema → CRM):
--   - Social Selling cria o lead no CRM (criação)
--   - Closer atualiza o status do negócio no CRM (atualização)
--
-- Esta tabela guarda cada tentativa de envio (sucesso ou erro), alimentando o
-- painel "Status de Sincronização Bidirecional" em Configurações › Integrações
-- (KPIs do mês + últimas sincronizações com retry).
--
-- O que NÃO precisa de migration (já é JSONB):
--   - os campos novos do Lead (crmExternoId, sincronizacaoCRM, ...) vivem em
--     comercial_leads.data;
--   - a config do CRM (provedor, escrita ativa, mapeamento de status de
--     saída) vai na coluna comercial_config.integracao_crm (criada na 088).
--
-- A chamada real à API de cada CRM ainda não existe (depende das credenciais
-- de cada tenant); o app simula o envio, mas o LOG já é real.
--
-- Fallback: se esta tabela não existir, o app guarda o log no localStorage
-- (não quebra). RLS: qualquer autenticado lê/escreve (o time comercial audita).
--
-- COMO RODAR: Painel do Supabase → SQL Editor → New query → cole tudo → Run.
-- =========================================================

create table if not exists crm_sync_logs (
  id text primary key,
  lead_id text not null,
  lead_nome text not null default '',
  tipo text not null check (tipo in ('criacao', 'atualizacao')),
  status text not null check (status in ('sucesso', 'erro')),
  provider text not null,
  payload_enviado jsonb not null default '{}'::jsonb,
  resposta_erro text,
  created_at timestamptz not null default now()
);

create index if not exists crm_sync_logs_created_idx on crm_sync_logs (created_at desc);
create index if not exists crm_sync_logs_lead_idx on crm_sync_logs (lead_id);

alter table crm_sync_logs enable row level security;
drop policy if exists "auth read crm sync" on crm_sync_logs;
drop policy if exists "auth write crm sync" on crm_sync_logs;
create policy "auth read crm sync" on crm_sync_logs for select using (auth.role() = 'authenticated');
create policy "auth write crm sync" on crm_sync_logs for all using (auth.role() = 'authenticated');
