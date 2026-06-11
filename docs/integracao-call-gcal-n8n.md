# Integração Call de Alinhamento ↔ Google Calendar (via n8n)

Quando uma call de alinhamento é marcada/editada na Central de Contas
(`/clientes` ou `/social/clientes`), o front dispara um webhook pro n8n
que cria/atualiza um evento no Google Calendar via API.

Mesma arquitetura do CRM Google Sheets — só inverte o sentido:
- CRM: GSheets → Edge Function → Supabase
- Call: Front → n8n webhook → Google Calendar

## 1. Arquitetura

```
CallAlinhamentoCell (front)
   │  ao salvar data / marcar realizada
   ▼
POST {webhook URL n8n} com header x-webhook-token
   │
   ▼
n8n workflow:
  1. Webhook trigger
  2. Validate header x-webhook-token
  3. IF evento_id_existente → Google Calendar: Update Event
     ELSE → Google Calendar: Create Event
  4. Respond {event_id}
   │
   ▼
Front recebe event_id e salva em clientes.gcal_event_id
(pra próximas edições atualizarem o MESMO evento, sem duplicar)
```

## 2. Workflow n8n — passo a passo

### 2.1 Criar credencial Google Calendar OAuth2

No n8n: **Credentials → New → Google Calendar OAuth2 API**.

Pode reutilizar a credencial OAuth2 que você já tem (a mesma do Google
Sheets serve se ela tiver scope de Calendar). Se não tiver:

- Em https://console.cloud.google.com pega Client ID + Secret OAuth2
- Adicione scope: `https://www.googleapis.com/auth/calendar`
- Autorize no n8n e teste

> **Alternativa:** Service Account com domain-wide delegation se
> MovMed usa Google Workspace. Permite criar eventos sem precisar
> autorizar usuário por usuário. Indicado se o evento ficar num
> calendar compartilhado ("MovMed - Calls de Alinhamento").

### 2.2 Criar o workflow

Nome sugerido: **"Agendar Call de Alinhamento"**.

Nodes (em ordem):

#### Node 1: **Webhook** (trigger)

- Method: `POST`
- Path: `agendar-call-alinhamento`
- Authentication: `Header Auth` (vai validar manualmente no IF abaixo)
- Response Mode: `When Last Node Finishes`
- Response Data: `First Entry JSON`

URL completa fica algo como:
```
https://n8n.movmed.com/webhook/agendar-call-alinhamento
```

#### Node 2: **IF** (valida token)

Condição:
```
{{ $headers["x-webhook-token"] }} == "SEU_TOKEN_SECRETO_AQUI"
```

Cria um token forte (ex: `openssl rand -hex 32`). Esse mesmo token vai
nas env vars do front.

- Branch TRUE → segue pro próximo node
- Branch FALSE → "Respond to Webhook" com `{ "error": "unauthorized" }` status 401

#### Node 3: **IF** (criar ou atualizar)

Checa se já tem evento existente:
```
{{ $json.evento_id_existente }} !== null
```

- TRUE  → vai pro node "Google Calendar - Update"
- FALSE → vai pro node "Google Calendar - Create"

#### Node 4a: **Google Calendar — Create Event**

- Calendar: o calendar destino (ex: `calls@movmed.com.br` se for shared,
  ou `primary` do service account)
- Start: `{{ $json.data_inicio }}` (formato `YYYY-MM-DDTHH:MM:SS`)
- End: `{{ $json.data_fim }}`
- Summary (título): `{{ $json.titulo }}`
- Description: `{{ $json.descricao }}`
- Attendees: `{{ $json.convidado_email }}`
- Send Updates: `all` (envia convite por email)
- Use Default Reminders: `true`
- Time Zone: `America/Sao_Paulo`

#### Node 4b: **Google Calendar — Update Event**

Mesmos campos do Create, MAIS:
- Event ID: `{{ $json.evento_id_existente }}`

#### Node 5: **Respond to Webhook**

Body:
```json
{
  "event_id": "{{ $json.id }}"
}
```

Status: 200

### 2.3 Ativar o workflow

Botão **Active** no canto superior direito.

## 3. Configurar as env vars no front

No arquivo `.env` do projeto (NÃO commita):

```env
VITE_GCAL_WEBHOOK_URL=https://n8n.movmed.com/webhook/agendar-call-alinhamento
VITE_GCAL_WEBHOOK_TOKEN=SEU_TOKEN_SECRETO_AQUI
```

E também no painel da Vercel (Project Settings → Environment Variables)
pra produção.

Após adicionar, **rode `npm run dev`** localmente e/ou redeploy no
Vercel pras envs entrarem em vigor.

## 4. Payload enviado pelo front

```jsonc
{
  "titulo": "Reunião de Alinhamento - Dr. João Silva",
  "descricao": "Call mensal de alinhamento com Dr. João Silva.\nAgendada por Maria Oliveira.\nEvento criado automaticamente pela Central de Contas MovMed.",
  "data_inicio": "2025-06-15T14:00:00",
  "data_fim": "2025-06-15T14:30:00",
  "cliente_id": "uuid-do-cliente",
  "cliente_nome": "Dr. João Silva",
  "convidado_email": "maria@movmed.com.br",
  "evento_id_existente": null  // ou string se for atualizar
}
```

## 5. Resposta esperada (do n8n pro front)

```jsonc
{
  "event_id": "abc123def456..."
}
```

O front grava esse `event_id` em `clientes.gcal_event_id` pra próxima
edição da data atualizar o MESMO evento (em vez de criar duplicata).

## 6. Comportamento gracioso

- Se `VITE_GCAL_WEBHOOK_URL` não estiver setada → integração é no-op.
  A data ainda salva normalmente, só não cria evento.
- Se o webhook falhar (n8n offline, token errado, etc) → log no console
  do browser, mas a data continua salva. Integração é "best effort".
- Convite vai SÓ pra quem agendou (decisão de projeto). Cliente não
  recebe convite automático — você manda manualmente se precisar.

## 7. Padrão fixo dos eventos

- **Título:** `Reunião de Alinhamento - <Nome do Cliente>`
- **Horário:** 14h, duração 30 min
- **Time Zone:** America/Sao_Paulo
- **Reminders:** padrão do calendar (1 dia antes + 30 min antes)

Esses defaults estão em `src/lib/gcal.ts` (constantes `HORA_INICIO` e
`DURACAO_MIN`). Pra mudar, edita lá.
