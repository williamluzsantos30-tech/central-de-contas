-- =========================================================
-- Migration 084: RLS por permissão de papel (Fase 3 — segurança real)
-- =========================================================
-- Transforma as permissões dos Papéis Operacionais (migration 083) em trava
-- de VERDADE no servidor. Até aqui era só interface (UX).
--
-- ⚠️ LEIA ANTES DE RODAR:
--  - Rode no SQL Editor do Supabase.
--  - Bypass: admin (profiles.role='admin') e quem NÃO tem papel atribuído
--    continuam liberados (fail-open de rollout). Então SEU login (admin)
--    não muda.
--  - Depois de rodar, teste com um usuário de papel restrito.
--  - Se algo travar indevidamente, o ROLLBACK está no fim do arquivo
--    (comentado) — cola e roda pra voltar ao estado anterior.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Helper: o usuário logado tem a permissão X?
--    SECURITY DEFINER pra ler profiles/papeis sem depender da RLS do caller.
--    Fail-open: admin, sem papel, ou perfil não encontrado → true.
-- ---------------------------------------------------------
create or replace function public.tem_permissao(p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    bool_or(
      pr.role = 'admin'
      or pr.papel_id is null
      or (po.permissoes @> array[p_perm])
    ),
    true  -- nenhum profile casou com auth.uid() → não trava (fail-open)
  )
  from profiles pr
  left join papeis_operacionais po on po.id = pr.papel_id
  where pr.auth_user_id = auth.uid() or pr.id = auth.uid();
$$;

grant execute on function public.tem_permissao(text) to authenticated;

-- ---------------------------------------------------------
-- 2. cliente_eventos: INSERT dos tipos MANUAIS por permissão.
--    Eventos automáticos (triggers de mudança em clientes: mrr, risco,
--    jornada, responsavel, contato, nps, servico...) continuam liberados,
--    senão um update de cliente quebraria. Só expansao/perda/churn (as
--    Ações Rápidas) exigem a permissão correspondente.
-- ---------------------------------------------------------
drop policy if exists "authenticated insert cliente_eventos" on cliente_eventos;
create policy "insert cliente_eventos por permissao" on cliente_eventos
  for insert with check (
    auth.role() = 'authenticated'
    and (
      tipo not in ('expansao', 'perda', 'churn')
      or (tipo = 'expansao' and tem_permissao('Registrar expansão'))
      or (tipo in ('perda', 'churn') and tem_permissao('Registrar churn'))
    )
  );

-- ---------------------------------------------------------
-- 3. clientes: SELECT exige "Visualizar clientes".
--    ⚠️ MAIOR ALCANCE: vale pra TODA leitura de clientes no app (lista,
--    ficha, Dashboard, Visão Executiva). Papéis sem essa permissão
--    (ex.: Comercial, Consultoria) deixam de ver dados de cliente em
--    qualquer tela. Admin e sem-papel continuam vendo.
--
--    Precisa TROCAR a policy "auth write clientes" (que era FOR ALL e por
--    isso também liberava SELECT) por policies separadas de escrita, senão
--    o SELECT continuaria passando por ela.
-- ---------------------------------------------------------
drop policy if exists "auth read clientes" on clientes;
drop policy if exists "auth write clientes" on clientes;

create policy "clientes select por permissao" on clientes
  for select using (
    auth.role() = 'authenticated' and tem_permissao('Visualizar clientes')
  );
-- Escrita segue liberada pra authenticated (a trava fina por campo — ex.:
-- "Editar status" só na coluna status — precisa de trigger; fica pra depois).
create policy "clientes insert auth" on clientes
  for insert with check (auth.role() = 'authenticated');
create policy "clientes update auth" on clientes
  for update using (auth.role() = 'authenticated');
create policy "clientes delete auth" on clientes
  for delete using (auth.role() = 'authenticated');

-- =========================================================
-- Ainda NÃO coberto (fica pra próximas iterações):
--  - "Editar status": trava por COLUNA (só status) precisa de trigger
--    BEFORE UPDATE — RLS não faz nível de coluna. Hoje segue só na UX.
--  - "Registrar NPS": não gateei nps_surveys aqui pra não arriscar o fluxo
--    público de resposta (anon). Segue só na UX.
-- =========================================================

-- =========================================================
-- ROLLBACK (cola e roda pra voltar ao estado anterior):
-- ---------------------------------------------------------
-- drop policy if exists "insert cliente_eventos por permissao" on cliente_eventos;
-- create policy "authenticated insert cliente_eventos" on cliente_eventos
--   for insert with check (auth.role() = 'authenticated');
--
-- drop policy if exists "clientes select por permissao" on clientes;
-- drop policy if exists "clientes insert auth" on clientes;
-- drop policy if exists "clientes update auth" on clientes;
-- drop policy if exists "clientes delete auth" on clientes;
-- create policy "auth read clientes" on clientes for select using (auth.role() = 'authenticated');
-- create policy "auth write clientes" on clientes for all using (auth.role() = 'authenticated');
--
-- drop function if exists public.tem_permissao(text);
-- =========================================================
