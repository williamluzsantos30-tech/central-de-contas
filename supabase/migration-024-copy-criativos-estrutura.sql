-- =========================================================
-- Migration 024 — Estrutura da Copy Criativos
-- =========================================================
-- Mesma estratégia das migrations 020 e 022 (planejamento_estrutura e
-- roteiro_estrutura): jsonb flexível, frontend tolera campos vazios.
--
-- Modelo "3 atos" adaptado pra copy de criativo estático:
-- {
--   "formato": "feed_estatico" | "story" | "carrossel" | "outro",
--   "plataforma": "Meta Ads",
--   "headline": { "texto": "...", "subheadline": "..." },
--   "corpo":    { "texto": "...", "pontos_chave": ["..."] },
--   "cta":      { "texto": "...", "link": "..." },
--   "hashtags": "..."
-- }
--
-- Idempotente.
-- =========================================================

alter table criacoes
  add column if not exists copy_criativos_estrutura jsonb;

comment on column criacoes.copy_criativos_estrutura is
  'Estrutura da Copy de Criativos: formato, plataforma, headline, corpo, cta, hashtags. Usado quando tipo=copy_criativos.';

-- Confirmação
select count(*) filter (where copy_criativos_estrutura is not null) as com_estrutura,
       count(*) filter (where tipo = 'copy_criativos') as copies_criativos_total
from criacoes;
