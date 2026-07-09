import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

type Opcoes = {
  /** Só guarda quando há uma tela real para voltar (proposta com id). */
  ativo: boolean
  /** Avalia, no momento do "voltar", se há conteúdo não salvo. */
  temAlteracoes: () => boolean
  /** Chamado quando é preciso confirmar a saída (abre o diálogo). */
  aoPedirConfirmacao: () => void
}

/**
 * M-042 F2a M3 · Guarda de saída (aviso "sair sem salvar").
 *
 * Intercepta o "voltar" em DUAS frentes:
 *  - a seta do app  → ligue `tentarSair` na `BarraTopo` (prop `aoVoltar`);
 *  - o botão físico / gesto do Android → via `popstate`.
 *
 * Com conteúdo não salvo (`temAlteracoes()` verdadeiro), pergunta antes de sair;
 * sem alterações, volta direto ao ponto de origem em 1 toque (casa com o B2).
 *
 * Mecânica (só quando `ativo`): no mount empurra UMA sentinela marcada em
 * `history.state`, reaproveitando-a se já voltamos sobre ela (não empilha a cada
 * picker). O histórico fica `[origem, /proposta, sentinela]` com a posição na
 * sentinela; o back nativo cai na entrada da proposta e o handler REPÕE a
 * sentinela (volta à posição) para então decidir. Sair de verdade = voltar 2
 * (sentinela + proposta) → origem. Em `/nova` (sem id) a sentinela não é usada:
 * lá a seta do app cobre o aviso e `garantirProposta` troca `/nova` pela
 * proposta real ao abrir um picker.
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

  /** Repõe a sentinela preservando o state do react-router (key/idx/usr). */
  function reporSentinela() {
    const atual = (window.history.state ?? {}) as Record<string, unknown>
    window.history.pushState({ ...atual, __guardaSaida: true }, '', window.location.href)
  }

  /** Sai de verdade: pula a sentinela + a entrada da proposta → origem. */
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

  useEffect(() => {
    if (!ativo) return
    const marcada =
      (window.history.state as { __guardaSaida?: boolean } | null)?.__guardaSaida === true
    if (!marcada) reporSentinela()

    const aoPop = () => {
      if (saindoRef.current) return // saída já autorizada em andamento
      reporSentinela() // desfaz o back nativo: volta à sentinela
      if (temAlteracoesRef.current()) aoPedirRef.current()
      else sair()
    }
    window.addEventListener('popstate', aoPop)
    return () => window.removeEventListener('popstate', aoPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo])

  return { tentarSair, sair }
}
