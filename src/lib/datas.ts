/**
 * Utilitários de data para os pedidos (M-002).
 * As datas de entrega são 'YYYY-MM-DD' (sem hora). Parseamos como data LOCAL
 * para não cair no fuso do toISOString (que jogaria a entrega para o dia anterior).
 */

/** Converte 'YYYY-MM-DD' em Date local à meia-noite. */
export function dataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/** 'YYYY-MM-DD' de uma Date local — evita o salto de fuso do toISOString. */
export function isoDeData(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Ex.: "20 de jun." */
export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(dataLocal(iso))
}

/** Ex.: "sex., 20 de junho" */
export function formatarDataLonga(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(dataLocal(iso))
}

/** Diferença em dias (data − hoje), ignorando horas. Negativo = atrasado. */
export function diasAte(iso: string): number {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = dataLocal(iso)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

/** Rótulo amigável: "Hoje", "Amanhã", "Atrasado 2d", ou a data formatada. */
export function rotuloEntrega(iso: string): string {
  const d = diasAte(iso)
  if (d === 0) return 'Hoje'
  if (d === 1) return 'Amanhã'
  if (d < 0) return `Atrasado ${Math.abs(d)}d`
  return formatarData(iso)
}
