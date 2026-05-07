# Edge Function `ai-generate`

Recebe `tipo + briefing + prompt + anexos + cliente` do frontend e chama OpenAI (GPT-4o)
para gerar conteúdo. Suporta análise de imagens (visão) e PDFs/textos como contexto.

## Pré-requisitos

1. Você precisa ter o **Supabase CLI** instalado:
   - Windows (PowerShell):
     ```powershell
     scoop install supabase
     ```
   - Ou baixe direto: https://github.com/supabase/cli/releases

2. Faça login no CLI:
   ```bash
   supabase login
   ```
   (vai abrir o browser pra você autenticar)

3. Vincule seu projeto local com o Supabase remoto:
   ```bash
   cd "C:\Users\willi\Downloads\Projeto Mov"
   supabase link --project-ref SEU-PROJECT-REF
   ```
   - O `project-ref` está na URL do dashboard: `https://app.supabase.com/project/SEU-PROJECT-REF`

## Configurar a chave da OpenAI

**Opção 1 — Pela interface (recomendado):**
1. Abre o Supabase Dashboard do seu projeto
2. **Project Settings** (engrenagem) → **Edge Functions** → **Manage Secrets** (ou "Add new secret")
3. Adiciona:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-...` (a chave nova que você gerou)
4. Save

**Opção 2 — Pelo CLI:**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-...
```

Verifica que tá configurada:
```bash
supabase secrets list
```

## Deploy

```bash
cd "C:\Users\willi\Downloads\Projeto Mov"
supabase functions deploy ai-generate
```

Esse comando:
- Sobe o código pro Supabase
- Cria o endpoint público em `https://SEU-PROJECT-REF.supabase.co/functions/v1/ai-generate`
- A função fica acessível ao frontend via `supabase.functions.invoke('ai-generate', { ... })`

## Testar

No app: vai em qualquer cliente → aba Criações → Nova Copy LP → preenche briefing → clica "Gerar com IA".

Deve gerar com base nos arquivos anexados. Se falhar, abre o console do navegador (F12) — terá um log `[ai-generate]` explicando o motivo, e o app cai num template local pra não quebrar.

## Logs e debug

Pra ver os logs em tempo real:
```bash
supabase functions logs ai-generate --tail
```

Ou na UI: **Functions** → `ai-generate` → **Invocations** / **Logs**.

## Custo aproximado

- Modelo usado: **GPT-4o** (`gpt-4o`)
- Texto puro (briefing curto, sem anexos): ~US$ 0.01–0.05 por geração
- Com 1 imagem como anexo: ~US$ 0.05–0.15
- Com PDF de 5 páginas como contexto: ~US$ 0.10–0.30

Defina um **monthly budget** na OpenAI pra não tomar susto: https://platform.openai.com/settings/organization/limits

## Trocar pra Claude (Anthropic) no futuro

Se preferir Claude, troque dentro de `index.ts`:
- Endpoint: `https://api.anthropic.com/v1/messages`
- Header: `x-api-key: ${ANTHROPIC_API_KEY}` + `anthropic-version: 2023-06-01`
- Body: formato `messages` com `content` array similar
- Variável: rename `OPENAI_API_KEY` → `ANTHROPIC_API_KEY`

A interface com o frontend continua a mesma.

## Limitações conhecidas

- **Extração de PDF é simples** — pega texto direto do stream. PDFs escaneados (sem texto digital) não funcionam. Pra OCR robusto, use o endpoint `/v1/files` da OpenAI ou um serviço como Document AI.
- **Imagens** ficam limitadas pelo modelo (GPT-4o aceita até 20 MB total por requisição).
- **Sem rate limit** ainda — qualquer usuário autenticado pode chamar. Se virar problema, posso adicionar contagem por user/dia.
