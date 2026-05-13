-- =========================================================
-- Migration 022 — Estrutura do Roteiro (3 atos)
-- =========================================================
-- Mesma estratégia da 020 (planejamento_estrutura): jsonb que comporta
-- a estrutura nova sem mexer em schema. Frontend tolera campos vazios.
--
-- Esquema (RoteiroEstrutura):
-- {
--   "formato": "reel" | "carrossel" | "tiktok" | "story" | "outro",
--   "duracao": "60s",
--   "gancho": { "texto": "...", "direcao": "..." },
--   "desenvolvimento": { "texto": "...", "acoes": "..." },
--   "fechamento": { "texto": "...", "cta": "..." },
--   "trilha": "..."
-- }
--
-- Idempotente.
-- =========================================================

alter table criacoes
  add column if not exists roteiro_estrutura jsonb;

comment on column criacoes.roteiro_estrutura is
  'Estrutura do Roteiro: formato, duracao, gancho, desenvolvimento, fechamento, trilha. Usado quando tipo=roteiro.';

-- Confirmação
select count(*) filter (where roteiro_estrutura is not null) as com_estrutura,
       count(*) filter (where tipo = 'roteiro') as roteiros_total
from criacoes;
