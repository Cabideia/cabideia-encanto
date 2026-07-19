import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-042 F2a · Referências de uma proposta (tabela `proposta_referencias`).
 *
 * Espelho de `usePedidoReferencias` (I5): cada referência liga a proposta a um
 * item de origem única — um trabalho (Meus Trabalhos) OU uma inspiração
 * (galeria) —, com `ordem` para a exibição. Aqui NÃO existe link público: é só
 * a coleção de referências da proposta (persistência interna).
 *
 * O hook fica de propósito enxuto (só ids + ordem): quem exibe resolve as
 * imagens cruzando com as listas já carregadas de trabalhos/inspirações. E
 * `adicionar` recebe a proposta alvo explicitamente (mesmo padrão do de pedido).
 */
export type OrigemReferencia = 'trabalho' | 'inspiracao'

export type PropostaReferencia = {
  id: string
  proposta_id: string
  trabalho_id: string | null
  inspiracao_id: string | null
  origem: OrigemReferencia
  ordem: number
  criado_em: string
}

/** Item a virar referência: a origem diz qual FK preencher; `id` é o do item. */
export type NovaReferencia = {
  origem: OrigemReferencia
  id: string
}

const COLUNAS = 'id, proposta_id, trabalho_id, inspiracao_id, ordem, criado_em'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(r: any): PropostaReferencia {
  return {
    id: r.id as string,
    proposta_id: r.proposta_id as string,
    trabalho_id: (r.trabalho_id ?? null) as string | null,
    inspiracao_id: (r.inspiracao_id ?? null) as string | null,
    origem: (r.trabalho_id ? 'trabalho' : 'inspiracao') as OrigemReferencia,
    ordem: (r.ordem ?? 0) as number,
    criado_em: r.criado_em as string,
  }
}

export function usePropostaReferencias(
  usuariaId: string | undefined,
  propostaId: string | undefined
) {
  const [referencias, setReferencias] = useState<PropostaReferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── Carrega as referências da proposta, em ordem de exibição ──
  const carregar = useCallback(async () => {
    if (!usuariaId || !propostaId) {
      setReferencias([])
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('proposta_referencias')
      .select(COLUNAS)
      .eq('proposta_id', propostaId)
      .order('ordem', { ascending: true })
    setReferencias((data ?? []).map(mapear))
    setCarregando(false)
  }, [usuariaId, propostaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Adiciona referências a uma proposta (o alvo é explícito). Ignora itens já
   * presentes naquela proposta e enfileira depois da última `ordem` existente.
   */
  async function adicionar(
    propostaAlvo: string,
    itens: NovaReferencia[]
  ): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    if (itens.length === 0) return null
    setSalvando(true)
    try {
      // Estado atual da proposta alvo: última ordem + itens já referenciados.
      const { data: atuais } = await supabase
        .from('proposta_referencias')
        .select('trabalho_id, inspiracao_id, ordem')
        .eq('proposta_id', propostaAlvo)
        .order('ordem', { ascending: false })

      const jaTem = new Set(
        (atuais ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => `${r.trabalho_id ? 't' : 'i'}:${r.trabalho_id ?? r.inspiracao_id}`
        )
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = ((atuais?.[0] as any)?.ordem ?? -1) + 1

      const novos = itens.filter(
        (it) => !jaTem.has(`${it.origem === 'trabalho' ? 't' : 'i'}:${it.id}`)
      )
      if (novos.length === 0) return null

      const linhas = novos.map((it, i) => ({
        proposta_id: propostaAlvo,
        trabalho_id: it.origem === 'trabalho' ? it.id : null,
        inspiracao_id: it.origem === 'inspiracao' ? it.id : null,
        ordem: base + i,
      }))
      const { error } = await supabase.from('proposta_referencias').insert(linhas)
      if (error) return 'Falha ao salvar as referências: ' + error.message
      if (propostaAlvo === propostaId) await carregar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  // ── Remove uma referência (atualização otimista) ──
  async function remover(id: string): Promise<string | null> {
    if (estaOffline()) return SEM_CONEXAO
    // M-051 · a cópia pública pertence ao ITEM do acervo (Decisão #50): remover
    // a referência não apaga nada do storage. Cópias por-referência antigas
    // (legado F2b) ficam no bucket — podem ter sido promovidas a cópia do item
    // pela migração m051; a limpeza do legado é tarefa própria, fora daqui.
    const { error } = await supabase.from('proposta_referencias').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    setReferencias((prev) => prev.filter((r) => r.id !== id))
    return null
  }

  /**
   * M-051 · Copia uma imagem de um bucket privado para o público e devolve o
   * caminho da cópia DO ITEM ({uid}/item/…). Quem chama grava esse caminho na
   * tabela do acervo (inspiracoes/trabalhos) — nunca mais na referência.
   */
  async function copiarParaPublico(bucket: string, pathPrivado: string): Promise<string | null> {
    if (!usuariaId) return null
    const { data, error } = await supabase.storage.from(bucket).download(pathPrivado)
    if (error || !data) return null
    const novo = `${usuariaId}/item/${crypto.randomUUID()}.jpg`
    const { error: upErro } = await supabase.storage
      .from('publico')
      .upload(novo, data, { contentType: 'image/jpeg', upsert: false })
    if (upErro) return null
    return novo
  }

  /**
   * M-051 · Garante que TODO ITEM referenciado com imagem tenha cópia pública
   * NO ACERVO antes de o link ser compartilhado (idempotente — só age no que
   * falta): a cópia é do item (`inspiracoes`/`trabalhos.foto_publica_path`),
   * gerada uma única vez e reaproveitada por vitrine, propostas e pedidos
   * (Decisões #42/#43/#50). A cópia por-referência (F2b) foi aposentada — as
   * RPCs ainda leem o valor antigo como último fallback, mas nada novo é
   * gravado nela. Inspiração-link (sem imagem): nada a fazer, aparece pelo url.
   *
   * BUG-011 (mantido) · se alguma cópia que PRECISAVA subir falhou, devolve
   * `{ erro }` para quem compartilha abortar o envio.
   */
  async function garantirFotosPublicas(propostaId: string): Promise<{ erro: string } | null> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    const { data, error } = await supabase
      .from('proposta_referencias')
      .select(
        'id, trabalho_id, inspiracao_id, trabalhos(foto_path, foto_publica_path), inspiracoes(foto_path, foto_publica_path)'
      )
      .eq('proposta_id', propostaId)
    if (error) return { erro: 'Não consegui preparar as fotos do link. Tente de novo.' }
    let falhou = false
    const prontos = new Set<string>() // itens já garantidos nesta passada
    for (const linha of (data ?? []) as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = linha as any
      if (r.trabalho_id) {
        if (r.trabalhos?.foto_publica_path || prontos.has(`t:${r.trabalho_id}`)) continue
        if (!r.trabalhos?.foto_path) continue
        const novo = await copiarParaPublico('acervo', r.trabalhos.foto_path)
        if (!novo) { falhou = true; continue }
        const { error: upErro } = await supabase
          .from('trabalhos')
          .update({ foto_publica_path: novo })
          .eq('id', r.trabalho_id)
        if (upErro) falhou = true
        else prontos.add(`t:${r.trabalho_id}`)
      } else if (r.inspiracao_id) {
        if (r.inspiracoes?.foto_publica_path || prontos.has(`i:${r.inspiracao_id}`)) continue
        if (!r.inspiracoes?.foto_path) continue // inspiração-link
        const novo = await copiarParaPublico('inspiracoes', r.inspiracoes.foto_path)
        if (!novo) { falhou = true; continue }
        const { error: upErro } = await supabase
          .from('inspiracoes')
          .update({ foto_publica_path: novo })
          .eq('id', r.inspiracao_id)
        if (upErro) falhou = true
        else prontos.add(`i:${r.inspiracao_id}`)
      }
    }
    return falhou ? { erro: 'Algumas fotos da proposta não subiram. Tente compartilhar de novo.' } : null
  }

  return { referencias, carregando, salvando, listar: carregar, adicionar, remover, garantirFotosPublicas }
}
