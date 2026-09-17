-- =========================================================
-- Migration 086: acessos de SETOR operacional por papel
-- =========================================================
-- Define, por papel, quais acessos operacionais ele carrega. Esses acessos
-- controlam DUAS coisas:
--   (a) sidebar: visibilidade das pastas Tráfego/Webdesign/Social (papel-first)
--   (b) ficha do cliente: quais abas operacionais aparecem
--       ("Operacional Tráfego" precisa de 'Operacional Tráfego';
--        "Operacional Social Media" precisa de 'Operacional Social Media').
--
-- Regra do Design: setor de Design (Designer, Editor de Vídeo) tem SÓ
-- 'Operacional Webdesign' — nunca recebe aba operacional na ficha (não tem
-- carteira de clientes). Por isso removemos Tráfego/Social desses papéis.
--
-- Cada update é AUTORITATIVO pros 3 acessos operacionais (remove os 3 e recoloca
-- o conjunto do grupo), preservando as demais permissões (Visualizar clientes,
-- Editar status, etc.). Idempotente.
--
-- ⚠️ Revise o mapeamento abaixo antes de rodar — reflete o quadro antigo de
-- Cargos × módulos, com o ajuste do Design. Papéis não listados (Coordenador
-- de Qualidade, Experiência do Cliente, Concierge, Comercial, Consultoria,
-- SDR) ficam SEM acesso de setor → caem no fallback (sidebar por cargo; ficha
-- mostra abas pelos serviços do cliente). Ajuste depois no editor de papel.
--
-- COMO RODAR: Supabase → SQL Editor → cole e Run.
-- =========================================================

-- Helper conceitual (inline em cada update):
--   novas = (permissoes atuais SEM os 3 acessos operacionais) + (acessos do grupo)

-- 1) DESIGN → Webdesign apenas (nunca aba operacional na ficha)
update papeis_operacionais set permissoes = (
  select coalesce(array_agg(p), array[]::text[]) from (
    select p from unnest(permissoes) as p
      where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
    union
    select unnest(array['Operacional Webdesign'])
  ) x(p)
) where nome in ('Designer', 'Editor de Vídeo');

-- 2) TRÁFEGO → Tráfego + Webdesign
update papeis_operacionais set permissoes = (
  select coalesce(array_agg(p), array[]::text[]) from (
    select p from unnest(permissoes) as p
      where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
    union
    select unnest(array['Operacional Tráfego', 'Operacional Webdesign'])
  ) x(p)
) where nome in ('Gestor de Tráfego', 'Head de Tráfego');

-- 3) SOCIAL → Social + Webdesign
update papeis_operacionais set permissoes = (
  select coalesce(array_agg(p), array[]::text[]) from (
    select p from unnest(permissoes) as p
      where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
    union
    select unnest(array['Operacional Social Media', 'Operacional Webdesign'])
  ) x(p)
) where nome in ('Social Media', 'Head de Conteúdo');

-- 4) MULTI (atende/oversee todos os setores) → Tráfego + Webdesign + Social
update papeis_operacionais set permissoes = (
  select coalesce(array_agg(p), array[]::text[]) from (
    select p from unnest(permissoes) as p
      where p not in ('Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media')
    union
    select unnest(array['Operacional Tráfego', 'Operacional Webdesign', 'Operacional Social Media'])
  ) x(p)
) where nome in ('Account Manager', 'Diretor', 'Coordenador Geral', 'Gerente Operacional');

-- Conferência (opcional):
-- select nome, permissoes from papeis_operacionais order by nome;
-- =========================================================
