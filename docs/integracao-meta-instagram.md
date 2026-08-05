# Integração Meta Instagram — Sync automático de métricas

Puxa **alcance médio**, **engajamento médio** e **seguidores** direto da conta Instagram Business de cada cliente, uma vez por dia, e preenche a tabela de métricas do mês automaticamente.

## Arquitetura

```
Cliente autoriza uma vez (OAuth):
  ┌──────────────┐    "Conectar Instagram"     ┌────────────────────────┐
  │  Frontend    │────────────────────────────>│ Meta OAuth Login       │
  │  (Vercel)    │<────────────────────────────│ (o cliente faz login)  │
  └──────────────┘        code=XXX             └────────────────────────┘
         │
         │ redirect com code
         ▼
  ┌──────────────────────────────────────┐
  │ Edge Function: meta-oauth-callback   │
  │  1. Troca code por short token       │
  │  2. Troca por long-lived (60 dias)   │
  │  3. Encripta e salva em DB           │
  └──────────────────────────────────────┘

Sync diario (03:30 UTC, via pg_cron):
  cron.job ─> pg_net ─> Edge Function: meta-sync-insights
                          │
                          ├─ Pra cada cliente com token valido:
                          │   1. GET /{ig-user-id}?fields=followers_count
                          │   2. GET /{ig-user-id}/media (posts do mes)
                          │   3. Pra cada media: GET /{media-id}/insights
                          │   4. Calcula media, salva em cliente_metricas_social
                          │
                          └─ Registra ultima_sync no meta_integracao_cliente

Refresh de token (semanal, via pg_cron):
  cron.job ─> pg_net ─> Edge Function: meta-refresh-tokens
                          │
                          └─ Renova tokens que expiram em <15 dias
```

## Setup no Meta for Developers

### Passo 1 — Cria o App

1. Vai em https://developers.facebook.com/apps
2. **Create App**
3. Tipo: **Business**
4. Nome: `MovMed Central de Contas`
5. Contact email: (seu email)
6. Business Account: seleciona seu Business Manager

### Passo 2 — Adiciona produto "Instagram Graph API"

1. No dashboard do app, coluna esquerda: **Add Product**
2. Localiza **Instagram Graph API** → clica **Set Up**
3. Pronto, produto adicionado

### Passo 3 — Adiciona produto "Facebook Login for Business"

1. **Add Product** → **Facebook Login for Business** → **Set Up**
2. Escolhe **Web** como plataforma
3. Site URL: `https://movmed.com.br` (ou seu dominio)
4. Em **Valid OAuth Redirect URIs**: **DEIXA VAZIO POR ENQUANTO** (te digo qual URL usar depois de escrever a Edge Function)

### Passo 4 — Verifica o domínio

1. **App Settings → Advanced → Domain Manager**
2. Adiciona `movmed.com.br`
3. Escolhe metodo de verificacao:
   - **Meta-tag**: cola no `<head>` do site (`<meta name="facebook-domain-verification" content="XXX" />`)
   - **DNS TXT**: adiciona registro TXT na Cloudflare/onde for o DNS
   - **HTML upload**: mais chato, evita
4. Clica **Verify**

### Passo 5 — Business Verification (do CNPJ)

Necessario pra passar App Review depois.

1. Vai em https://business.facebook.com/settings/security
2. **Business Verification** → **Start Verification**
3. Preenche:
   - CNPJ
   - Razão social
   - Endereço
4. Envia documentos:
   - Contrato social (PDF)
   - Comprovante de endereço em nome da empresa (nao pode ser conta pessoal)
5. Meta valida em **3-15 dias uteis**. Fica em paralelo, nao bloqueia dev.

### Passo 6 — Pega credenciais pra me passar

No dashboard do app:

1. **Settings → Basic**
2. **App ID** (número no topo) — me passa
3. **App Secret** — clica em **Show**, coloca sua senha do FB, me passa

> ⚠️ **App Secret e' segredo.** Nao commita em codigo, nao manda no WhatsApp. Me manda por 1Password / Bitwarden / campo de senha, ou eu te dou uma URL segura pra colar.

### Passo 7 — App Review (depois que eu terminar a implementacao)

Meta libera as permissoes que a gente precisa APENAS depois de aprovar o app:

- `instagram_basic`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

Quando eu terminar a integracao, a gente submete o App Review junto:

- Descreve caso de uso: "Agencia digital que gerencia contas Instagram Business de clientes medicos; usa a Graph API pra ler metricas dos posts (reach, engagement, followers) e mostrar em dashboard interno."
- Grava um video de ~2 min mostrando o fluxo: um cliente clica "Conectar", autoriza, e o dashboard mostra os dados.
- Envia. Meta responde em **2-4 semanas**.

**Enquanto Meta nao aprova**, a gente testa em **Development Mode**: funciona com ate 25 Instagram Business accounts que voce adicionar como "test users".

## O que fica no banco

### Tabela `meta_integracao_cliente` (migration 063)

Uma linha por cliente que autorizou. Guarda:
- `ig_user_id`, `ig_username`, `page_id`, `page_name` — identificacao
- `access_token_encrypted` (bytea) — token long-lived, encriptado
- `token_expires_at` — quando expira (default 60 dias, renovavel)
- `ultima_sync`, `ultima_sync_status`, `ultima_sync_erro` — rastreio

RLS bloqueia todo mundo exceto `service_role`. Frontend le via view `meta_integracao_cliente_public` (sem token).

### Extensao `cliente_metricas_social` (migration 064)

Adiciona:
- `sync_source`: `'manual'` (default) | `'meta_api'`
- `sincronizado_em`: timestamp da ultima sync bem-sucedida

Logica: sync do Meta **nao sobrescreve** registro `source=manual` (respeita override do user). Se quiser re-sincronizar, apaga o registro manual primeiro OU passa flag `force=true` na Edge Function.

## Fluxo pro cliente autorizar

O medico entra no sistema (login normal). Na pagina dele, aparece um card:

```
┌─────────────────────────────────────────────────┐
│ ✨ Conectar Instagram                            │
│                                                  │
│ Ative a integracao pra suas metricas serem      │
│ atualizadas automaticamente todo dia.           │
│                                                  │
│ [ Conectar minha conta do Instagram ]           │
└─────────────────────────────────────────────────┘
```

Clica → redirect pro Meta → login → autorizar permissoes → volta pro sistema → mensagem "Conectado! Proxima sincronizacao amanha as 03:30".

## Rate limits e custos

- **Meta Graph API**: 200 chamadas/hora por app (default)
- **Nosso uso estimado**: 
  - 100 clientes × (1 chamada `/media` + ~8 chamadas de insights + 1 chamada de followers) = ~1000 chamadas/dia
  - Distribuido em 1 hora de sync = ~1000/h → **acima do limite**
  - Solucao: **batchificar** — 200/h = ~5h de sync. OU pedir upgrade do rate limit no App Review.
- **Custo**: Meta Graph API e' **gratuita**. Edge Functions Supabase: gratis ate 500k invocacoes/mes (bem folgado).

## Troubleshooting

### Cliente autorizou mas nada aparece

1. Confere se o token nao expirou:
   ```sql
   select * from meta_integracao_cliente_public where cliente_id = '<uuid>';
   ```
2. Se `token_status = 'expirado'`, cliente precisa reautorizar (a gente notifica por email antes de expirar).
3. Se `ultima_sync_status` for `error: xxx`, olha o log da Edge Function `meta-sync-insights`.

### Meta reprovou o App Review

Motivos comuns:
- Video de demo mal explicado → refazer, mostrando claramente o valor pro cliente final
- Faltou explicar como o cliente **desativa** a integracao → adiciona documentacao
- Domain nao verificado → refaz passo 4
- Business Verification pendente → espera aprovar antes

### Sync tá lenta

Ver o cron log:
```sql
select j.jobname, r.status, r.return_message, r.start_time
  from cron.job_run_details r
  join cron.job j on j.jobid = r.jobid
 where j.jobname like 'meta_%'
 order by r.start_time desc limit 10;
```

## Custos totais estimados

| Item | Custo |
|---|---|
| Meta App + Graph API | R$ 0 |
| Business Verification | R$ 0 |
| Dominio (se nao tiver) | R$ 40/ano |
| Supabase Edge Functions | R$ 0 (dentro do free tier) |
| Supabase Pro (se necessario pra pg_cron) | ~R$ 125/mes — **ja tem** |
| **Total** | **R$ 40/ano** se comprar dominio |
