import { useEffect, useState } from 'react'
import { Icone } from './Icone'
import { formatarReal, precoParaNumero } from '../hooks/useCardapio'

/**
 * M-044 · Linha de um item da tabela de preços já congelado numa proposta OU num
 * pedido (mesmo desenho — paridade). Nome vem do snapshot; quantidade, preço e
 * unidade são editáveis SÓ aqui (nesta proposta/pedido), sem tocar a tabela de
 * preços. O total do item = quantidade × preço é calculado na hora, não persiste.
 *
 * Edição enxuta: os campos são texto controlado local e só COMITAM ao sair do
 * foco (onBlur) — evita uma gravação por tecla. Um valor inválido volta ao que
 * estava. Preço vazio = "sem preço" (mantém o item, só sem valor).
 */
/**
 * M-044 · Aviso OBRIGATÓRIO exibido junto do total, na proposta e no pedido
 * (texto travado). A tabela estruturada só cobre itens da tabela de preços; o
 * que a dona somou "por fora" (na descrição) precisa entrar no total à mão.
 */
export function avisoItensForaTabela(alvo: 'proposta' | 'pedido'): string {
  const onde = alvo === 'proposta' ? 'da proposta' : 'do pedido'
  return `Se você acrescentou itens que não estão na tabela de preços, ajuste o valor total ${onde} antes de enviar ao cliente.`
}

export type ItemEditavel = {
  nome_snapshot: string
  preco_snapshot: number | null
  unidade_snapshot: string | null
  quantidade: number
}

export type PatchItemEditavel = {
  quantidade?: number
  preco_snapshot?: number | null
  unidade_snapshot?: string | null
}

function qtdParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? n : null
}

function fmtQtd(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q).replace('.', ',')
}

function fmtPreco(p: number | null): string {
  return p != null ? String(p).replace('.', ',') : ''
}

export function LinhaItemEditavel({
  item,
  onAtualizar,
  onRemover,
  desabilitado,
}: {
  item: ItemEditavel
  onAtualizar: (patch: PatchItemEditavel) => void
  onRemover: () => void
  desabilitado?: boolean
}) {
  const [qtdTexto, setQtdTexto] = useState(fmtQtd(item.quantidade))
  const [precoTexto, setPrecoTexto] = useState(fmtPreco(item.preco_snapshot))
  const [unidadeTexto, setUnidadeTexto] = useState(item.unidade_snapshot ?? '')

  // Reflete mudanças vindas de fora (recarga/otimista) quando não se está digitando.
  useEffect(() => setQtdTexto(fmtQtd(item.quantidade)), [item.quantidade])
  useEffect(() => setPrecoTexto(fmtPreco(item.preco_snapshot)), [item.preco_snapshot])
  useEffect(() => setUnidadeTexto(item.unidade_snapshot ?? ''), [item.unidade_snapshot])

  function comitarQtd() {
    const n = qtdParaNumero(qtdTexto)
    if (n == null) return setQtdTexto(fmtQtd(item.quantidade)) // inválido → volta
    if (n !== item.quantidade) onAtualizar({ quantidade: n })
  }

  function comitarPreco() {
    const n = precoParaNumero(precoTexto) // null = sem preço
    if (n !== item.preco_snapshot) onAtualizar({ preco_snapshot: n })
  }

  function comitarUnidade() {
    const u = unidadeTexto.trim() || null
    if (u !== (item.unidade_snapshot ?? null)) onAtualizar({ unidade_snapshot: u })
  }

  const totalItem = item.preco_snapshot != null ? item.preco_snapshot * item.quantidade : null

  return (
    <div
      style={{
        border: '1px solid var(--linha)',
        borderRadius: 12,
        padding: '10px 12px',
        marginBottom: 8,
        background: 'var(--acucar)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{item.nome_snapshot}</span>
        <button
          type="button"
          className="btn-icone"
          onClick={onRemover}
          disabled={desabilitado}
          aria-label={`Tirar ${item.nome_snapshot} da lista`}
        >
          <Icone nome="fechar" size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
        <label style={{ flex: '0 0 68px' }}>
          <span className="apoio" style={{ display: 'block', marginBottom: 2 }}>Qtd</span>
          <input
            value={qtdTexto}
            onChange={(e) => setQtdTexto(e.target.value)}
            onBlur={comitarQtd}
            inputMode="decimal"
            disabled={desabilitado}
            aria-label={`Quantidade de ${item.nome_snapshot}`}
          />
        </label>
        <label style={{ flex: '1 1 92px', minWidth: 0 }}>
          <span className="apoio" style={{ display: 'block', marginBottom: 2 }}>Preço (R$)</span>
          <input
            value={precoTexto}
            onChange={(e) => setPrecoTexto(e.target.value)}
            onBlur={comitarPreco}
            placeholder="sem preço"
            inputMode="decimal"
            disabled={desabilitado}
            aria-label={`Preço de ${item.nome_snapshot} nesta lista`}
          />
        </label>
        <label style={{ flex: '1 1 84px', minWidth: 0 }}>
          <span className="apoio" style={{ display: 'block', marginBottom: 2 }}>Unidade</span>
          <input
            value={unidadeTexto}
            onChange={(e) => setUnidadeTexto(e.target.value)}
            onBlur={comitarUnidade}
            placeholder="ex.: kg"
            maxLength={20}
            disabled={desabilitado}
            aria-label={`Unidade de ${item.nome_snapshot} nesta lista`}
          />
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <span className="apoio">
          Total do item:{' '}
          <b style={{ color: 'var(--framboesa)' }}>
            {totalItem != null ? formatarReal(totalItem) : 'sem preço'}
          </b>
        </span>
      </div>
    </div>
  )
}
