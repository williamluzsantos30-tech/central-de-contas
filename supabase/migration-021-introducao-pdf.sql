-- =========================================================
-- Migration 021 — Introdução do PDF (template global + override)
-- =========================================================
-- O texto "Sobre essa copy / Sobre esse roteiro / Sobre esse planejamento"
-- que aparece no PDF era hardcoded. Agora:
--
-- 1. Cada tipo tem um TEMPLATE global editável (config_criacoes_intros).
-- 2. Cada Criacao pode SOBREESCREVER o texto via criacoes.introducao_pdf.
--
-- O front faz a cascata: criacao.introducao_pdf > config.paragrafos > hardcoded.
--
-- Idempotente.
-- =========================================================

-- 1) Override per-criação
alter table criacoes
  add column if not exists introducao_pdf text;

comment on column criacoes.introducao_pdf is
  'Texto customizado da introducao do PDF dessa criacao. Quando null, o PDF usa o template global de config_criacoes_intros.';

-- 2) Tabela de templates globais (1 linha por tipo)
create table if not exists config_criacoes_intros (
  tipo text primary key,
  titulo text not null default '',
  paragrafos jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

comment on table config_criacoes_intros is
  'Templates do bloco "Sobre essa entrega" que aparece no PDF de cada Criacao. Editavel via Admin > Configuracoes de Criacoes.';

-- 3) Seed com os defaults hardcoded de hoje (so insere se nao existir)
insert into config_criacoes_intros (tipo, titulo, paragrafos) values
  (
    'copy_lp',
    'Sobre essa copy',
    '["O objetivo dessa copy é conectar com o público-alvo do cliente, atacar suas principais dores e gerar autoridade, levando o visitante a tomar a ação desejada na landing page.","A copy foi estruturada em blocos (headline, subhead, prova social, oferta, CTA) pensada pra ser conversiva — ou seja, transformar visita em lead/contato.","Após aprovação, a copy segue automaticamente pra produção da landing page com a equipe de design."]'::jsonb
  ),
  (
    'copy_criativos',
    'Sobre essas copies de criativo',
    '["São variações de copy para os anúncios (Meta Ads / Google Ads). Cada variação testa um ângulo diferente: dor, desejo, prova social, urgência.","O objetivo é abrir leque de testes pra identificar qual mensagem gera mais CTR e CPL no público do cliente.","Após aprovação, as copies seguem automaticamente pra produção do criativo com a equipe de design."]'::jsonb
  ),
  (
    'planejamento',
    'Sobre esse planejamento',
    '["Documento estratégico que organiza as campanhas do cliente: objetivos, público, plataformas, orçamento, criativos previstos e KPIs alvo.","Serve como guia pra equipe de tráfego executar a operação com foco e pra alinhar expectativas com o cliente sobre o que está sendo entregue no mês."]'::jsonb
  ),
  (
    'roteiro',
    'Sobre esse roteiro',
    '["Roteiro estruturado para vídeo (reel/anúncio) ou carrossel. Define gancho inicial, desenvolvimento, prova/argumento e CTA.","Pensado pra prender atenção nos primeiros segundos, manter retenção e conduzir até a ação desejada."]'::jsonb
  )
on conflict (tipo) do nothing;

-- 4) RLS — auth lê e escreve
alter table config_criacoes_intros enable row level security;

drop policy if exists "auth read config_criacoes_intros" on config_criacoes_intros;
drop policy if exists "auth write config_criacoes_intros" on config_criacoes_intros;

create policy "auth read config_criacoes_intros"
  on config_criacoes_intros
  for select
  using (auth.role() = 'authenticated');

create policy "auth write config_criacoes_intros"
  on config_criacoes_intros
  for all
  using (auth.role() = 'authenticated');

-- 5) Confirmação
select tipo, titulo, jsonb_array_length(paragrafos) as qtd_paragrafos
from config_criacoes_intros
order by tipo;
