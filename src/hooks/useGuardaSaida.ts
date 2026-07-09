import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

type Opcoes = {
  /** Só guarda enquanto o form está de fato aberto (nunca na tela "não encontrada"). */
  ativo: boolean
  /** Avalia, no momento do "voltar", se há conteúdo não salvo. */
  temAlteracoes: () => boolean
  /** Chamado quando é preciso confirmar a saída (abre o diálogo). */
  aoPedirConfirmacao: () => void
}

/**
 * M-042 F2a M3 · Guarda de saída (aviso "sair sem salvar").
 *
 * Intercepta o "voltar" em DUAS frentes, com o MESMO comportamento (consistência
 * pedida pela gestão):
 *  - a seta do app  → ligue `tentarSair` na `BarraTopo` (prop `aoVoltar`);
 *  - o botão físico / gesto do Android → via `popstate`.
 *
 * Com conteúdo não salvo (`temAlteracoes()` verdadeiro), pergunta antes de sair;
 * sem alterações, volta direto ao ponto de origem em 1 toque (casa com o B2).
 *
 * Mecânica (quando `ativo` — vale já na "Nova proposta", não só na edição): no
 * mount empurra UMA sentinela marcada em `history.state`, reaproveitando-a se já
 * voltamos sobre ela. O histórico fica `[origem, form, sentinela]` com a posição
 * na sentinela; o back nativo cai na entrada do form e o handler REPÕE a
 * sentinela para então decidir. Sair de verdade = voltar 2 (sentinela + form) →
 * origem.
 *
 * `navegarLimpo(fn)` navega para frente (abrir um picker, ou trocar "/nova" pela
 * proposta real) SEM deixar a sentinela empilhada: primeiro volta sobre a
 * entrada real do form (popando a sentinela) e só então executa `fn` DENTRO do
 * popstate — com a posição já assentada, um `replace` troca a entrada certa e a
 * "/nova" não sobrevive (fecha o B2 sem abrir buraco no aviso da tela nova).
 */
export function useGuardaSaida({ ativo, temAlteracoes, aoPedirConfirmacao }: Opcoes) {
  const navegar = useNavigate()

  // Refs sempre atualizadas (o handler de popstate é registrado uma vez).
  const temAlteracoesRef = useRef(temAlteracoes)
  temAlteracoesRef.current = temAlteracoes
  const aoPedirRef = useRef(aoPedirConfirmacao)
  aoPedirRef.current = aoPedirConfirmacao
  const ativoRef = useRef(ativo)
  ativoRef.current = ativo
  const saindoRef = useRef(false)
  const pendenteRef = useRef<null | (() => void)>(null)

  /** Repõe a sentinela preservando o state do react-router (key/idx/usr). */
  function reporSentinela() {
    const atual = (window.history.state ?? {}) as Record<string, unknown>
    window.history.pushState({ ...atual, __guardaSaida: true }, '', window.location.href)
  }

  /** Sai de verdade: pula a sentinela + a entrada do form → origem. */
  function sair() {
    saindoRef.current = true
    if (ativoRef.current) window.history.go(-2)
    else navegar(-1)
  }

  /** Handler da seta do app. */
  function tentarSair() {
    if (temAlteracoesRef.current()) aoPedirRef.current()
    else sair()
  }

  /**
   * Navega para frente colapsando a sentinela antes: volta sobre a entrada real
   * do form (pop) e roda `fn` no popstate (posição assentada), para que um
   * replace dentro de `fn` troque a entrada do form — não a sentinela.
   */
  function navegarLimpo(fn: () => void) {
    if (!ativoRef.current) {
      fn()
      return
    }
    pendenteRef.current = fn
    saindoRef.current = true
    window.history.go(-1)
  }

  useEffect(() => {
    if (!ativo) return
    const marcada =
      (window.history.state as { __guardaSaida?: boolean } | null)?.__guardaSaida === true
    if (!marcada) reporSentinela()

    const aoPop = () => {
      // Colapso do navegarLimpo: já voltamos sobre a entrada do form — navega.
      if (pendenteRef.current) {
        const fn = pendenteRef.current
        pendenteRef.current = null
        saindoRef.current = false
        fn()
        return
      }
      if (saindoRef.current) return // saída já autorizada em andamento
      reporSentinela() // desfaz o back nativo: volta à sentinela
      if (temAlteracoesRef.current()) aoPedirRef.current()
      else sair()
    }
    window.addEventListener('popstate', aoPop)
    return () => window.removeEventListener('popstate', aoPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])

  return { tentarSair, sair, navegarLimpo }
}
