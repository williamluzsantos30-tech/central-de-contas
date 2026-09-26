/**
 * Exportação CSV no navegador, pronta pro Excel em pt-BR: separador ";",
 * vírgula decimal e BOM UTF-8 (sem o BOM o Excel quebra os acentos).
 */
type Celula = string | number | null | undefined

function celula(v: Celula): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? v.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 }) : String(v)
  // Aspas se tiver separador, aspas ou quebra de linha.
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gerarCsv(cabecalho: string[], linhas: Celula[][]): string {
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
}

export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]): void {
  const blob = new Blob(['﻿' + gerarCsv(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
