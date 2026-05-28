-- =============================================================
-- SEED FICTÍCIO — Controle do Head de Tráfego
-- =============================================================
-- Popula cliente_saude_plataforma + verificacoes_conta usando os
-- clientes de tráfego REAIS que já existem na base, com saúde e
-- métricas variadas (críticas / instáveis / estáveis) pra você ver
-- o painel cheio.
--
-- ⚠️ São DADOS FICTÍCIOS. Pra limpar tudo depois, rode no final:
--     delete from verificacoes_conta;
--     delete from cliente_saude_plataforma;
--   (isso devolve todos os clientes pra "estável" via trigger)
--
-- Pré-req: migrations 043 e 044 já rodadas.
-- Pode rodar VÁRIAS vezes — ele limpa o seed anterior antes de repopular.
-- =============================================================
do $$
declare
  v_autor uuid;
  v_ids uuid[];
  v_id uuid;
  v_i int := 0;
  v_status text;
  v_seg date := date_trunc('week', now())::date;  -- segunda desta semana
begin
  -- Autor das verificações: 1º head/diretoria/admin (fallback: qualquer um)
  select id into v_autor
    from profiles
   where aprovado and ativo
     and (
       role::text = 'admin'
       or cargo::text in ('head','diretoria')
       or cargos_extras && array['head','diretoria']
     )
   order by created_at
   limit 1;

  if v_autor is null then
    select id into v_autor from profiles where aprovado and ativo order by created_at limit 1;
  end if;

  if v_autor is null then
    raise exception 'Nenhum profile aprovado/ativo encontrado pra ser autor das verificações.';
  end if;

  -- Limpa seed anterior (idempotente)
  delete from verificacoes_conta;
  delete from cliente_saude_plataforma;

  -- Até 14 clientes de tráfego ativos (exclui churn/arquivado/onboarding)
  select array_agg(id order by nome) into v_ids
    from (
      select id, nome
        from clientes
       where 'trafego' = any(modulos)
         and arquivado_em is null
         and status <> 'churn'
         and (jornada is null or jornada::text <> 'onboarding')
       order by nome
       limit 14
    ) t;

  if v_ids is null or array_length(v_ids, 1) is null then
    raise notice 'Nenhum cliente de tráfego ativo encontrado. Cadastre clientes primeiro.';
    return;
  end if;

  -- Itera nos clientes atribuindo perfis variados por índice
  foreach v_id in array v_ids loop
    v_i := v_i + 1;

    if v_i <= 2 then
      -- ===== CRÍTICAS (2): Meta crítica + Google estável =====
      insert into cliente_saude_plataforma
        (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
      values
        (v_id, 'meta_ads',   'critico', 8,  240.50, 3800, 6000, -42, v_autor),
        (v_id, 'google_ads', 'estavel', 14, 95.00,  1900, 2500,   5, v_autor);

      insert into verificacoes_conta
        (cliente_id, plataforma, autor_id, problema, plano_acao, status_plano, created_at)
      values
        (v_id, 'meta_ads', v_autor,
         'CPL Meta disparou de R$ 120 pra R$ 240 em 7 dias. Públicos lookalike perdendo performance.',
         'Pausar conjuntos com CPL > R$ 200; subir 3 criativos novos com prova social; testar lookalike 1%.',
         'em_andamento', (v_seg + 1)::timestamptz + interval '10 hours'),
        (v_id, 'meta_ads', v_autor,
         'Anúncios reprovados pelo Meta no fim de semana, entrega caiu.',
         'Recurso enviado; campanha backup ativada com criativos alternativos.',
         'concluido', (now() - interval '9 days')),
        (v_id, 'google_ads', v_autor,
         'Performance Max sem entregar, Search performando bem.',
         'Manter Search; refazer assets do PMax com criativos novos.',
         'concluido', (now() - interval '5 days'));

      -- Crítica há 15 dias → cai na regra "escalar diretoria"
      update clientes set status_geral_desde = now() - interval '15 days' where id = v_id;

    elsif v_i <= 5 then
      -- ===== INSTÁVEIS (3) =====
      if v_i = 3 then
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'meta_ads',   'instavel', 18, 92.00, 1400, 1800, -8, v_autor),
          (v_id, 'google_ads', 'estavel',  14, 65.00,  900, 1200,  3, v_autor);
        insert into verificacoes_conta
          (cliente_id, plataforma, autor_id, problema, plano_acao, status_plano, created_at)
        values
          (v_id, 'meta_ads', v_autor,
           'Frequência alta em 2 conjuntos (>4), CTR começando a cair.',
           'Subir 2 criativos novos esta semana; pausar os mais antigos.',
           'em_andamento', (v_seg + 1)::timestamptz + interval '14 hours');
      elsif v_i = 4 then
        -- Instável há 24 dias → cai na regra "reclassificar como crítica"
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'google_ads', 'instavel', 22, 120.00, 2600, 3500, 5, v_autor);
        insert into verificacoes_conta
          (cliente_id, plataforma, autor_id, problema, plano_acao, status_plano, created_at)
        values
          (v_id, 'google_ads', v_autor,
           'Conta no piloto automático, sem otimização há semanas.',
           'Briefing com gestor pra revisar palavras-chave e copy; trazer 2 novos ângulos.',
           'aberto', (now() - interval '4 days'));
        update clientes set status_geral_desde = now() - interval '24 days' where id = v_id;
      else
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'meta_ads',   'instavel', 27, 88.00,  2200, 2800, 12, v_autor),
          (v_id, 'tiktok_ads', 'instavel', 6,  145.00,  870, 1000, 25, v_autor);
        insert into verificacoes_conta
          (cliente_id, plataforma, autor_id, problema, plano_acao, status_plano, created_at)
        values
          (v_id, 'meta_ads', v_autor,
           'Cliente cobrando mais leads, verba não está sendo gasta toda.',
           'Aumentar orçamento diário em 30%; ampliar segmentação geográfica.',
           'em_andamento', (v_seg + 2)::timestamptz + interval '11 hours');
      end if;

    else
      -- ===== ESTÁVEIS (resto) =====
      -- Alterna entre só Meta, Meta+Google e só Google
      if v_i % 3 = 0 then
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'meta_ads',   'estavel', 35 + v_i, 60 + v_i, 2500, 4000, 8, v_autor),
          (v_id, 'google_ads', 'estavel', 18 + v_i, 80 + v_i, 1500, 2200, 4, v_autor);
      elsif v_i % 3 = 1 then
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'meta_ads', 'estavel', 40 + v_i, 55 + v_i, 3000, 4500, 6, v_autor);
      else
        insert into cliente_saude_plataforma
          (cliente_id, plataforma, status_saude, leads_30d, cpl, verba_gasta, verba_orcamento, tendencia_pct, updated_by)
        values
          (v_id, 'google_ads', 'estavel', 25 + v_i, 70 + v_i, 2800, 3800, 10, v_autor);
      end if;

      -- 70% das estáveis com 1 verificação na semana (cadência cumprida)
      if v_i % 10 < 7 then
        insert into verificacoes_conta
          (cliente_id, plataforma, autor_id, problema, plano_acao, status_plano, created_at)
        values
          (v_id,
           (select plataforma from cliente_saude_plataforma where cliente_id = v_id limit 1),
           v_autor,
           'Performance dentro do esperado, CPL e CTR estáveis.',
           'Manter setup atual; sem ação necessária esta semana.',
           'concluido', (v_seg + 1)::timestamptz + interval '9 hours');
      end if;
    end if;
  end loop;

  raise notice 'Seed concluído: % clientes populados.', array_length(v_ids, 1);
end$$;

-- Conferência rápida
select
  (select count(*) from cliente_saude_plataforma) as plataformas_cadastradas,
  (select count(*) from verificacoes_conta)        as verificacoes_cadastradas,
  (select count(*) from clientes where status_saude_geral = 'critico') as clientes_criticos,
  (select count(*) from clientes where status_saude_geral = 'instavel') as clientes_instaveis,
  (select count(*) from clientes where status_saude_geral = 'estavel'
     and 'trafego' = any(modulos) and arquivado_em is null) as clientes_estaveis;
