/**
 * Motor de importação de conteúdos do calendário.
 *
 * Recebe um texto com uma LISTA de conteúdos estruturados e converte cada
 * bloco num item do calendário (producoes_social_media_items). Função PURA
 * (sem I/O, sem React) pra ser testável e idêntica entre domus e Central.
 *
 * MAPEAMENTO:
 *   CATEGORIA              -> formato + is_backlog (Carrossel|Reels|Estático|Backlog)
 *   DATA                   -> prazo (data de postagem)
 *   TÍTULO/TEMA            -> titulo
 *   CONTEÚDO/ROTEIRO/COPY  -> copy_texto (Copy da arte: texto dos slides / roteiro)
 *   IDEIA                  -> ideia_conteudo (descrição curta no planejamento/PDF)
 *   LEGENDA                -> legenda
 *   LINK DO DRIVE          -> link_drive_video (destacado em Reels)
 *
 *   (Até 30/09/2026 o CONTEÚDO ia pra ideia_conteudo — a copy caía na
 *   descrição do planejamento e não na Copy que o designer usa.)
 *
 * REGRAS:
 *   1. Se a CATEGORIA já veio no bloco, classifica sozinho (não pergunta).
 *   2. Rejeita SÓ blocos cuja categoria não é uma das quatro aceitas.
 *   3. Um item por bloco.
 *   4. Preserva roteiro/textos/datas/legendas/links (só apara espaço nas bordas).
 *   5. Campo "PENDENTE" (ou vazio numa data) cria o item e sinaliza pendência.
 *   6. Reels destacam o LINK DO DRIVE.
 *   8. Não altera o conteúdo editorial — só interpreta, classifica e mapeia.
 *
 * Aceita DOIS formatos de entrada, detectados automaticamente:
 *   a) Blocos rotulados: linhas "CATEGORIA: Reels", "DATA: 20/09/2026", ...
 *      Um novo bloco começa a cada linha CATEGORIA (ou separador ---/===).
 *      Valores podem ter várias linhas (ex.: ROTEIRO longo).
 *   b) Planilha (TSV): 1ª linha = cabeçalho com os rótulos, colada do
 *      Excel/Sheets (colunas separadas por TAB). Uma linha = um item.
 */
import type { FormatoSocialMedia } from '@/types/database'

export type CategoriaImport = 'carrossel' | 'reel' | 'estatico' | 'backlog'

export const CATEGORIAS_VALIDAS = ['Carrossel', 'Reels', 'Estático', 'Backlog'] as const

/** Item já interpretado, pronto pra virar registro no banco. */
export interface ItemParseado {
  categoria: CategoriaImport
  /** formato salvo no banco (backlog usa 'estatico'). */
  formato: FormatoSocialMedia
  isBacklog: boolean
  titulo: string
  /** CONTEÚDO / ROTEIRO / COPY -> copy_texto (Copy da arte) */
  copy: string | null
  /** IDEIA -> ideia_conteudo (descrição no planejamento) */
  ideia: string | null
  legenda: string | null
  /** LINK DO DRIVE -> link_drive_video */
  linkDrive: string | null
  /** Data de postagem em ISO (YYYY-MM-DD) ou null quando pendente/backlog. */
  data: string | null
  /** Rótulos dos campos que ficaram pendentes (DATA, TÍTULO, LINK DO DRIVE...). */
  pendencias: string[]
  /** Bloco original, pra debug/preview. */
  raw: string
}

export interface BlocoRejeitado {
  raw: string
  motivo: string
}

export interface ResultadoImport {
  itens: ItemParseado[]
  rejeitados: BlocoRejeitado[]
}

type Campo = 'categoria' | 'data' | 'titulo' | 'copy' | 'ideia' | 'legenda' | 'link'

/** Remove acentos + upper + colapsa espaços — pra casar rótulos/categorias. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

const PENDENTE_RE = /^PENDENTE$/i

/** Mapeia o rótulo de um campo (normalizado) pro nosso Campo interno. */
function campoDeLabel(labelNorm: string): Campo | null {
  const L = labelNorm.replace(/\s*\/\s*/g, '/') // "TITULO / TEMA" -> "TITULO/TEMA"
  if (L === 'CATEGORIA' || L === 'CATEGORIA DO CONTEUDO') return 'categoria'
  if (L.startsWith('DATA')) return 'data'
  if (['TITULO', 'TEMA', 'TITULO/TEMA', 'TEMA/TITULO'].includes(L)) return 'titulo'
  if (
    [
      'CONTEUDO',
      'ROTEIRO',
      'CONTEUDO/ROTEIRO',
      'ROTEIRO/CONTEUDO',
      'COPY',
      'COPY/ROTEIRO',
      'ROTEIRO/COPY',
      'COPY DO POST',
      'COPY DA ARTE',
      'TEXTO DOS SLIDES',
    ].includes(L)
  )
    return 'copy'
  if (['IDEIA', 'IDEIA DO CONTEUDO'].includes(L)) return 'ideia'
  if (L === 'LEGENDA') return 'legenda'
  if (L.startsWith('LINK') || L === 'DRIVE' || L === 'ARQUIVO') return 'link'
  return null
}

/** Classifica a CATEGORIA nas 4 aceitas. null = inválida (rejeitar). */
function classificaCategoria(
  valor: string,
): { categoria: CategoriaImport; formato: FormatoSocialMedia; isBacklog: boolean } | null {
  const V = norm(valor)
  if (V === 'CARROSSEL' || V === 'CARROSSEIS') return { categoria: 'carrossel', formato: 'carrossel', isBacklog: false }
  if (V === 'REELS' || V === 'REEL') return { categoria: 'reel', formato: 'reel', isBacklog: false }
  if (V === 'ESTATICO' || V === 'ESTATICOS') return { categoria: 'estatico', formato: 'estatico', isBacklog: false }
  // Backlog = reserva estática (migration 075): fica fora do calendário até
  // ganhar data e sair do backlog.
  if (V === 'BACKLOG') return { categoria: 'backlog', formato: 'estatico', isBacklog: true }
  return null
}

/** Converte DATA em ISO. Aceita YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD/MM. */
function parseData(valor: string): { iso: string | null; pendente: boolean } {
  const s = valor.trim()
  if (!s) return { iso: null, pendente: true }
  if (PENDENTE_RE.test(s)) return { iso: null, pendente: true }

  // ISO YYYY-MM-DD (com ou sem hora)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return validaISO(+iso[1], +iso[2], +iso[3])

  // DD/MM/YYYY | DD/MM/YY | DD/MM (barra, ponto ou hífen)
  const br = s.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/)
  if (br) {
    const dia = +br[1]
    const mes = +br[2]
    let ano = br[3] ? +br[3] : new Date().getFullYear()
    if (ano < 100) ano += 2000
    return validaISO(ano, mes, dia)
  }
  // Não deu pra interpretar -> trata como pendência (não inventa data).
  return { iso: null, pendente: true }
}

function validaISO(ano: number, mes: number, dia: number): { iso: string | null; pendente: boolean } {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { iso: null, pendente: true }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { iso: `${ano}-${pad(mes)}-${pad(dia)}`, pendente: false }
}

/** Valor "PENDENTE"/vazio -> null. Preserva o resto integralmente. */
function valorOuNull(v: string | undefined): { valor: string | null; pendente: boolean } {
  const s = (v ?? '').trim()
  if (!s) return { valor: null, pendente: false }
  if (PENDENTE_RE.test(s)) return { valor: null, pendente: true }
  return { valor: s, pendente: false }
}

/**
 * Tira a ideia que veio GRUDADA no começo do conteúdo:
 *   "Ideia: explicar X. / Lâmina 1 (capa): "…" / Lâmina 2: …"
 *   → ideia "Explicar X."  ·  copy "Lâmina 1 (capa): "…" / Lâmina 2: …"
 * A ideia termina na quebra de linha ou no " / " que abre o próximo rótulo
 * (Lâmina, Título, Texto, Gancho… — qualquer "Rótulo:" curto). Sem "Ideia:"
 * no começo, devolve o texto como está.
 */
export function separarIdeia(texto: string | null): { ideia: string | null; copy: string | null } {
  if (!texto) return { ideia: null, copy: texto }
  const m = texto.match(/^\s*ideia(?:\s+do\s+conte[uú]do)?\s*:\s*/i)
  if (!m) return { ideia: null, copy: texto }
  const resto = texto.slice(m[0].length)
  const fim = resto.search(/\n|\s\/\s*(?=[^\s/][^/:\n]{0,40}:)/)
  const ideiaBruta = (fim === -1 ? resto : resto.slice(0, fim)).trim()
  const copy = fim === -1 ? '' : resto.slice(fim).replace(/^\s*\/?\s*/, '').trim()
  const ideia = ideiaBruta ? ideiaBruta.charAt(0).toUpperCase() + ideiaBruta.slice(1) : null
  return { ideia, copy: copy || null }
}

/** Monta um ItemParseado a partir dos campos crus de um bloco. */
function montaItem(
  campos: Partial<Record<Campo, string>>,
  raw: string,
): ItemParseado | BlocoRejeitado {
  const catRaw = (campos.categoria ?? '').trim()
  if (!catRaw) return { raw, motivo: 'Bloco sem CATEGORIA.' }
  const cat = classificaCategoria(catRaw)
  if (!cat) {
    return {
      raw,
      motivo: `Categoria inválida: "${catRaw}". Use Carrossel, Reels, Estático ou Backlog.`,
    }
  }

  const pendencias: string[] = []

  // Título/Tema
  const tituloRes = valorOuNull(campos.titulo)
  let titulo = tituloRes.valor ?? ''
  if (!titulo || tituloRes.pendente) {
    titulo = 'Sem título'
    pendencias.push('TÍTULO')
  }

  // Data (backlog não exige data)
  const dataRes = parseData(campos.data ?? '')
  if (dataRes.pendente && !cat.isBacklog) pendencias.push('DATA')

  // Copy (conteúdo / roteiro) e ideia. "Ideia: …" grudada no começo do
  // CONTEÚDO sai da copy e vai pra ideia (a copy é só o que entra na arte).
  const copyRes = valorOuNull(campos.copy)
  if (copyRes.pendente) pendencias.push('CONTEÚDO/ROTEIRO')
  const ideiaRes = valorOuNull(campos.ideia)
  const separado = separarIdeia(copyRes.valor)

  // Legenda
  const legendaRes = valorOuNull(campos.legenda)
  if (legendaRes.pendente) pendencias.push('LEGENDA')

  // Link do Drive (obrigatório-em-espírito só pra Reels -> pendência)
  const linkRes = valorOuNull(campos.link)
  if (cat.categoria === 'reel' && !linkRes.valor) pendencias.push('LINK DO DRIVE')
  else if (linkRes.pendente) pendencias.push('LINK DO DRIVE')

  return {
    categoria: cat.categoria,
    formato: cat.formato,
    isBacklog: cat.isBacklog,
    titulo,
    copy: separado.copy,
    ideia: ideiaRes.valor ?? separado.ideia,
    legenda: legendaRes.valor,
    linkDrive: linkRes.valor,
    data: dataRes.iso,
    pendencias,
    raw,
  }
}

const SEP_RE = /^\s*[-=*_]{3,}\s*$/

/** Detecta planilha: maioria das linhas úteis tem TAB e o cabeçalho tem CATEGORIA. */
function pareceTabela(linhas: string[]): boolean {
  const uteis = linhas.filter((l) => l.trim() && !SEP_RE.test(l))
  if (uteis.length < 2) return false
  const comTab = uteis.filter((l) => l.includes('\t')).length
  if (comTab < uteis.length - 1) return false // quase todas com tab
  const header = uteis[0].split('\t').map((c) => campoDeLabel(norm(c)))
  return header.includes('categoria')
}

function parseTabela(linhas: string[]): ResultadoImport {
  const itens: ItemParseado[] = []
  const rejeitados: BlocoRejeitado[] = []
  const uteis = linhas.filter((l) => l.trim() && !SEP_RE.test(l))
  const header = uteis[0].split('\t').map((c) => campoDeLabel(norm(c)))
  for (let i = 1; i < uteis.length; i++) {
    const cells = uteis[i].split('\t')
    const campos: Partial<Record<Campo, string>> = {}
    header.forEach((campo, idx) => {
      if (campo && cells[idx] != null) campos[campo] = cells[idx]
    })
    const res = montaItem(campos, uteis[i])
    if ('motivo' in res) rejeitados.push(res)
    else itens.push(res)
  }
  return { itens, rejeitados }
}

function parseBlocos(linhas: string[]): ResultadoImport {
  // Quebra em blocos: separador (---) OU início de uma nova CATEGORIA.
  const blocos: string[][] = []
  let cur: string[] = []
  let curTemCategoria = false
  const flush = () => {
    if (cur.some((l) => l.trim())) blocos.push(cur)
    cur = []
    curTemCategoria = false
  }
  for (const linha of linhas) {
    if (SEP_RE.test(linha)) {
      flush()
      continue
    }
    const idx = linha.indexOf(':')
    const ehCategoria = idx > 0 && campoDeLabel(norm(linha.slice(0, idx))) === 'categoria'
    if (ehCategoria && curTemCategoria) flush()
    if (ehCategoria) curTemCategoria = true
    cur.push(linha)
  }
  flush()

  const itens: ItemParseado[] = []
  const rejeitados: BlocoRejeitado[] = []
  for (const bloco of blocos) {
    const campos: Partial<Record<Campo, string>> = {}
    let campoAtual: Campo | null = null
    for (const linha of bloco) {
      const idx = linha.indexOf(':')
      const campo = idx > 0 ? campoDeLabel(norm(linha.slice(0, idx))) : null
      if (campo) {
        campoAtual = campo
        const val = linha.slice(idx + 1).trim()
        campos[campo] = campos[campo] ? `${campos[campo]}\n${val}` : val
      } else if (campoAtual) {
        // Continuação multi-linha do campo anterior (ex.: roteiro longo).
        campos[campoAtual] = campos[campoAtual]
          ? `${campos[campoAtual]}\n${linha}`
          : linha
      }
    }
    // Limpa espaço nas bordas de cada campo (preserva o miolo).
    for (const k of Object.keys(campos) as Campo[]) campos[k] = campos[k]?.trim()
    const res = montaItem(campos, bloco.join('\n').trim())
    if ('motivo' in res) rejeitados.push(res)
    else itens.push(res)
  }
  return { itens, rejeitados }
}

/**
 * Ponto de entrada do motor. Recebe o texto cru e devolve os itens
 * interpretados + os blocos rejeitados (categoria inválida / sem categoria).
 */
export function parseConteudos(raw: string): ResultadoImport {
  const texto = (raw ?? '').replace(/\r\n?/g, '\n')
  const linhas = texto.split('\n')
  if (pareceTabela(linhas)) return parseTabela(linhas)
  return parseBlocos(linhas)
}
