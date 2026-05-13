-- =========================================================
-- Migration 023 — Edição de Vídeo
-- =========================================================
-- Nova esteira de produção em Webdesign — edicoes_video.
-- 5 status: pendente → em_edicao → em_aprovacao → em_alteracao → conclusao.
--
-- SLA: lote de 2 vídeos × 3 dias úteis (mesma lógica do Social Media,
-- mas com lote=2 ao invés de 3). Prazo auto-calculado a partir de
-- aprovado_em (ou created_at como fallback) usando add_business_days.
--
-- Referências (Drive, YouTube, links) e arquivos brutos ficam em jsonb.
--
-- Idempotente.
-- =========================================================

-- 1) Tabela principal
create table if not exists edicoes_video (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text,
  status text not null default 'pendente',
  responsavel_id uuid references profiles(id) on delete set null,
  ordem int not null default 0,
  prazo date,
  aprovado_em timestamptz,
  briefing text,
  -- Lista de referências: [{tipo, url, descricao}]
  --   tipo ∈ 'drive' | 'youtube' | 'vimeo' | 'link'
  referencias jsonb not null default '[]'::jsonb,
  -- Arquivos brutos: [{nome, tamanho, tipo, url}]
  arquivos jsonb not null default '[]'::jsonb,
  -- Vídeo final entregue
  video_final_url text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table edicoes_video is
  'Esteira de Edição de Vídeo. SLA: 2 videos a cada 3 dias uteis (lote=2).';

create index if not exists idx_edicoes_video_cliente on edicoes_video(cliente_id);
create index if not exists idx_edicoes_video_status on edicoes_video(status);
create index if not exists idx_edicoes_video_responsavel on edicoes_video(responsavel_id);

-- 2) Trigger updated_at
create or replace function trg_edicoes_video_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists edicoes_video_updated_at on edicoes_video;
create trigger edicoes_video_updated_at
  before update on edicoes_video
  for each row
  execute function trg_edicoes_video_updated_at();

-- 3) Recalcular prazo: lote = ceil(posicao/2), prazo = ref + lote × 3 dias úteis
--    Posição = ordem (estável); ref = aprovado_em ou created_at como fallback.
--    Recalcula TODOS os items do mesmo cliente (não-finalizados) pra manter
--    a sequência consistente.
create or replace function recalcular_prazos_edicao_video(p_cliente_id uuid)
returns void
language plpgsql
as $$
begin
  with items_ordenados as (
    select id,
           row_number() over (order by ordem asc, created_at asc) as posicao,
           coalesce(aprovado_em::date, created_at::date) as ref_date
    from edicoes_video
    where cliente_id = p_cliente_id
      and status <> 'conclusao'
  )
  update edicoes_video e
     set prazo = add_business_days(
           io.ref_date,
           ceil(io.posicao::numeric / 2)::int * 3
         )
    from items_ordenados io
   where e.id = io.id;
end;
$$;

-- 4) Trigger: recalcula quando muda aprovado_em / ordem / status / cliente_id
create or replace function trg_edicao_video_recalc_prazo()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform recalcular_prazos_edicao_video(new.cliente_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if (new.aprovado_em is distinct from old.aprovado_em)
       or (new.ordem is distinct from old.ordem)
       or (new.status is distinct from old.status)
       or (new.cliente_id is distinct from old.cliente_id) then
      perform recalcular_prazos_edicao_video(new.cliente_id);
      if new.cliente_id is distinct from old.cliente_id then
        perform recalcular_prazos_edicao_video(old.cliente_id);
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform recalcular_prazos_edicao_video(old.cliente_id);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists edicao_video_recalc_prazo on edicoes_video;
create trigger edicao_video_recalc_prazo
  after insert or update or delete on edicoes_video
  for each row
  execute function trg_edicao_video_recalc_prazo();

-- 5) RLS
alter table edicoes_video enable row level security;

drop policy if exists "auth read edicoes_video" on edicoes_video;
drop policy if exists "auth write edicoes_video" on edicoes_video;

create policy "auth read edicoes_video"
  on edicoes_video
  for select
  using (auth.role() = 'authenticated');

create policy "auth write edicoes_video"
  on edicoes_video
  for all
  using (auth.role() = 'authenticated');

-- Confirmação
select count(*) as total_edicoes_video from edicoes_video;
