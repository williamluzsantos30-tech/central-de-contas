// =============================================================
// Helper de upload para o Supabase Storage
// =============================================================
// Substitui o antigo padrão `URL.createObjectURL(file)` (que dava
// uma URL `blob:` que sumia ao recarregar a página) por upload
// real pra um bucket do Supabase, retornando a URL pública.
//
// Pré-requisito: rodar a migration 006 (cria os buckets
// `webdesign-assets` e `criacoes-anexos` com as policies).
// =============================================================

import { supabase } from './supabase'

export type StorageBucket = 'webdesign-assets' | 'criacoes-anexos'

/**
 * Faz upload de um arquivo pro Supabase Storage e devolve a URL
 * pública dele. Lança erro se o upload falhar.
 *
 * @param file   O arquivo (PDF, imagem, etc.)
 * @param folder Pasta lógica dentro do bucket (ex.: 'projetos/briefings').
 * @param bucket Bucket destino. Default: 'webdesign-assets'.
 */
export async function uploadToStorage(
  file: File,
  folder: string,
  bucket: StorageBucket = 'webdesign-assets',
): Promise<string> {
  const safeName = (file.name || 'arquivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80)
  const stamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '') || 'misc'
  const path = `${cleanFolder}/${stamp}-${random}-${safeName}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(error.message || 'Upload falhou')
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Versão "segura" do upload: alerta o usuário em caso de falha
 * (em vez de jogar exceção) e retorna `null`.
 *
 * Útil pra handlers que precisam continuar fluindo (limpar loading,
 * etc.) mesmo se o upload der ruim.
 */
export async function uploadToStorageSafe(
  file: File,
  folder: string,
  bucket: StorageBucket = 'webdesign-assets',
): Promise<string | null> {
  try {
    return await uploadToStorage(file, folder, bucket)
  } catch (e) {
    const msg = (e as Error).message || 'erro desconhecido'
    alert(
      `Falha ao enviar "${file.name}": ${msg}\n\n` +
        'Verifique sua conexão. Se persistir, confirme se a migration ' +
        '006-storage.sql foi rodada no Supabase.',
    )
    return null
  }
}

/** Retorna `true` se a URL é um blob: legado (não acessível). */
export function isDeadBlobUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith('blob:')
}

/** Devolve a URL ou string vazia se ela for um blob: morto. */
export function stripBlobUrl(url: string | null | undefined): string {
  return isDeadBlobUrl(url) ? '' : url ?? ''
}

/** Remove URLs blob: E strings vazias/em-branco de um array de strings.
 *  URL vazia gera <img src=""> = caixa muda no render. Melhor filtrar. */
export function stripBlobUrls(urls: string[] | null | undefined): string[] {
  return (urls ?? []).filter((u) => typeof u === 'string' && u.trim() !== '' && !isDeadBlobUrl(u))
}
