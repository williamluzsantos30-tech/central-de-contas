# Central de Contas MovMed

Plataforma interna para a agência MovMed Squad Delta gerenciar a operação de clientes (médicos/clínicas): tarefas recorrentes, ativos digitais, metas, leads (CRM unificado) e log de otimizações.

**Stack:** React 18 + Vite + TypeScript + Tailwind + Supabase (Auth + Postgres + Edge Functions)

---

## Pré-requisitos

- Node.js 18+ (`node -v`)
- Conta no [Supabase](https://supabase.com) (plano grátis já atende)

## Setup — passo a passo

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar projeto no Supabase

1. Entre em https://supabase.com → **New Project**
2. Anote **Project URL** e **anon public key** (Settings → API)

### 3. Aplicar o schema

No Supabase Studio → **SQL Editor** → cole e execute, nesta ordem:

1. `supabase/schema.sql` — cria tipos, tabelas, RLS, triggers (inclui trigger que auto-aplica templates e ativos ao criar cliente)
2. `supabase/seed-templates.sql` — popula os 7 templates iniciais

### 4. Variáveis de ambiente

Crie um arquivo `.env` na raiz (copie de `.env.example`):

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 5. Rodar

```bash
npm run dev
```

Abra http://localhost:5173.

### 6. Criar sua conta de admin

1. Na tela de login, clique em **Criar uma conta**.
2. Depois, no Supabase Studio → **Table Editor → `profiles`**, edite seu registro e altere `role` para `admin`.
3. Faça logout e login de novo — os menus Admin e Templates aparecerão.

---

## Estrutura do projeto

```
src/
  components/
    ativos/        → cards editáveis dos 5 ativos
    clientes/      → form + indicador de saúde
    layout/        → sidebar, header, shell
    leads/         → painel CRM com import CSV
    metas/         → metas mensais + realizado
    otimizacoes/   → timeline vertical + form
    tarefas/       → item, drawer de detalhes, modal novo
    ui/            → primitivos (Button, Input, Modal, etc.)
  contexts/AuthContext.tsx
  lib/
    supabase.ts    → client
    utils.ts       → formatters, labels, helpers
  pages/
    Login.tsx
    Dashboard.tsx
    Clientes.tsx
    ClienteDetalhe.tsx  (abas: Visão, Tarefas, Ativos, Metas, CRM, Log)
    MinhasTarefas.tsx
    Templates.tsx  (admin)
    Admin.tsx      (admin)
  types/database.ts
supabase/
  schema.sql
  seed-templates.sql
  functions/
    regenerate-recurring-tasks/  → regeneração diária (cron)
    kommo-webhook/               → receber leads do Kommo
```

---

## Regras de negócio implementadas

1. **Auto-bootstrap de cliente:** ao inserir um cliente, o trigger `trg_cliente_bootstrap` cria automaticamente todas as tarefas a partir dos templates ativos + os 5 ativos iniciais com status `pendente`.
2. **Auto-criação de perfil:** ao registrar uma conta via Supabase Auth, o trigger `on_auth_user_created` cria a linha em `profiles` com role `gestor`.
3. **Polling de 60s:** Dashboard e lista de clientes atualizam sozinhos.
4. **Recorrência de tarefas:** edge function em `supabase/functions/regenerate-recurring-tasks` gera a próxima instância após uma tarefa ser concluída (diária +1d, semanal +7d, mensal +30d; esporádicas não regeneram).
5. **RLS básico:** qualquer usuário autenticado lê e escreve. Para restringir por role, edite as policies do SQL.

---

## Deploy das Edge Functions (opcional, quando quiser ativar recorrência e Kommo)

Instale a CLI do Supabase:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <seu-project-ref>
supabase functions deploy regenerate-recurring-tasks
supabase functions deploy kommo-webhook
```

**Agendar a recorrência diariamente:** Database → Cron (ou `pg_cron`):

```sql
select cron.schedule(
  'regen-tasks-daily',
  '10 3 * * *',  -- 03:10 UTC todos os dias
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/regenerate-recurring-tasks',
       headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.settings.service_role'))
     ); $$
);
```

**Kommo:** aponte o webhook de leads para `https://<project-ref>.supabase.co/functions/v1/kommo-webhook` e garanta que o `account_id` do Kommo bata com o campo `kommo_account_id` do cliente.

---

## Build de produção

```bash
npm run build
npm run preview
```

Deploy: Vercel, Netlify, Cloudflare Pages, ou qualquer host estático. Lembre de definir as mesmas env vars no painel do provedor.

---

## Roadmap pós-MVP

- Refinar RLS por role (admin total / gestor só o que gerencia / supervisor read-only em tudo)
- Notificações push/e-mail de tarefas atrasadas
- Upload de anexos em tarefas (Supabase Storage)
- Importar clientes em massa a partir do ClickUp via CSV
- Painel de relatórios avançado (gráficos com Recharts)
