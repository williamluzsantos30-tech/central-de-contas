-- =========================================================
-- Migration 020 — Estrutura de Planejamento de Tráfego
-- =========================================================
-- O PDF do Planejamento deixou de ser texto solto e virou um deck
-- estruturado com Diagnóstico (Pontos Fortes / Oportunidades /
-- Desafios), Campanhas (várias) e Estratégias.
--
-- Salva o objeto inteiro em jsonb pra ficar flexível — futuros
-- campos não exigem nova migration.
--
-- Idempotente.
-- =========================================================

alter table criacoes
  add column if not exists planejamento_estrutura jsonb;

comment on column criacoes.planejamento_estrutura is
  'Estrutura do Planejamento de Trafego: { diagnostico: { pontos_fortes, oportunidades, desafios }, campanhas: [{ titulo, objetivo, publico, criativos[], formatos[] }], estrategias: [{ titulo, descricao, bullets[] }] }. Usado apenas quando tipo=planejamento.';

-- Confirmação
select count(*) filter (where planejamento_estrutura is not null) as com_estrutura,
       count(*) filter (where tipo = 'planejamento') as planejamentos_total
from criacoes;
