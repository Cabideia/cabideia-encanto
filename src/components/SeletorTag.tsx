import { useState } from 'react'
import { Icone } from './Icone'
import type { Tag } from '../hooks/useAcervo'

type SeletorTagProps = {
  /** Todas as tags da dona (tabela `tags`, compartilhada entre acervo e inspirações). */
  todasTags: Tag[]
  /** Ids já escolhidos/aplicados — somem das sugestões (não deixa repetir). */
  selecionadas: string[]
  /** Escolheu uma tag (existente ou recém-criada). */
  onSelecionar: (tag: Tag) => void
  /** Cria (ou reusa) uma tag pelo nome digitado — devolve a tag ou null. */
  onCriar: (nome: string) => Promise<Tag | null>
  placeholder?: string
  /** Classe do input (ex.: 'painel-input' no bottom-sheet; vazio dentro de .campo). */
  inputClassName?: string
}

/**
 * Autocomplete de tags (padrão M-009): input + sugestões filtradas ao digitar +
 * "Criar 'x'" quando o texto ainda não é uma tag. Componente compartilhado entre
 * o Acervo (adicionar tag a uma foto) e o lote de inspirações do pedido.
 *
 * Só cuida da ENTRADA — quem usa desenha os chips já escolhidos, porque cada tela
 * remove de um jeito (API otimista no acervo, estado local no lote).
 */
export function SeletorTag({
  todasTags,
  selecionadas,
  onSelecionar,
  onCriar,
  placeholder,
  inputClassName,
}: SeletorTagProps) {
  const [texto, setTexto] = useState('')

  const alvo = texto.trim().toLowerCase()
  const disponiveis = todasTags.filter((t) => !selecionadas.includes(t.id))
  const sugestoes = disponiveis.filter((t) => !alvo || t.nome.includes(alvo))
  const podeCriar = !!alvo && !todasTags.some((t) => t.nome === alvo)

  function escolher(tag: Tag) {
    onSelecionar(tag)
    setTexto('')
  }
  async function criar() {
    if (!alvo) return
    const tag = await onCriar(texto)
    if (tag) onSelecionar(tag)
    setTexto('')
  }

  return (
    <>
      <input
        className={inputClassName}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (sugestoes.length > 0) escolher(sugestoes[0])
            else if (podeCriar) criar()
          }
        }}
        placeholder={placeholder ?? 'Digite para buscar ou criar…'}
        autoCapitalize="none"
      />
      {(sugestoes.length > 0 || podeCriar) && (
        <div className="tags-area" style={{ paddingTop: 8 }}>
          {sugestoes.map((t) => (
            <button key={t.id} type="button" className="tag-chip" onClick={() => escolher(t)}>
              <Icone nome="mais" size={13} /> {t.nome}
            </button>
          ))}
          {podeCriar && (
            <button type="button" className="tag-criar" onClick={criar}>
              Criar “{texto.trim()}”
            </button>
          )}
        </div>
      )}
    </>
  )
}
