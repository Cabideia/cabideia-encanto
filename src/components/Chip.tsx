export type StatusPedido = 'a_fazer' | 'em_producao' | 'entregue' | 'cancelado'

const ROTULOS: Record<StatusPedido, string> = {
  a_fazer: 'A fazer',
  em_producao: 'Em produção',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
}

const CLASSES: Record<StatusPedido, string> = {
  a_fazer: 'afazer',
  em_producao: 'producao',
  entregue: 'entregue',
  cancelado: 'cancelado'
}

/** Padrão 5: chip de status com cores fixas em todo o app. */
export function Chip({ status }: { status: StatusPedido }) {
  return <span className={`chip ${CLASSES[status]}`}>{ROTULOS[status]}</span>
}
