import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * M-042 · Referências de um pedido (tabela `pedido_referencias`).
 *
 * Cada referência liga o pedido a um item de origem única — um trabalho (Meus
 * Trabalhos) OU uma inspiração (galeria) —, com `ordem` para a exibição. O shape
 * espelha `selecao_itens`, mas aqui NÃO existe link público: é só a coleção de
 * referências do pedido (persistência interna).
 *
 * O hook fica de propósito enxuto (só ids + ordem): quem exibe resolve as
 * imagens cruzando com as listas já carregadas de trabalhos/inspirações. E
 * `adicionar` recebe o pedido alvo explicitamente, para a Fase 2 conseguir
 * copiar as referências da proposta para o pedido recém-criado na conversão.
 */
export type OrigemReferencia = 'trabalho' | 'inspiracao'

export type PedidoReferencia = {
  id: string
  pedido_id: string
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

const COLUNAS = 'id, pedido_id, trabalho_id, inspiracao_id, ordem, criado_em'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(r: any): PedidoReferencia {
  return {
    id: r.id as string,
    pedido_id: r.pedido_id as string,
    trabalho_id: (r.trabalho_id ?? null) as string | null,
    inspiracao_id: (r.inspiracao_id ?? null) as string | null,
    origem: (r.trabalho_id ? 'trabalho' : 'inspiracao') as OrigemReferencia,
    ordem: (r.ordem ?? 0) as number,
    criado_em: r.criado_em as string,
  }
}

export function usePedidoReferencias(
  usuariaId: string | undefined,
  pedidoId: string | undefined
) {
  const [referencias, setReferencias] = useState<PedidoReferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // ── Carrega as referências do pedido, em ordem de exibição ──
  const carregar = useCallback(async () => {
    if (!usuariaId || !pedidoId) {
      setReferencias([])
      setCarregando(false)
      return
    }
    const { data } = await supabase
      .from('pedido_referencias')
      .select(COLUNAS)
      .eq('pedido_id', pedidoId)
      .order('ordem', { ascending: true })
    setReferencias((data ?? []).map(mapear))
    setCarregando(false)
  }, [usuariaId, pedidoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Adiciona referências a um pedido (o alvo é explícito — pode ser outro que
   * não o carregado, p.ex. na conversão da Fase 2). Ignora itens já presentes
   * naquele pedido e enfileira depois da última `ordem` existente.
   */
  async function adicionar(
    pedidoAlvo: string,
    itens: NovaReferencia[]
  ): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    if (itens.length === 0) return null
    setSalvando(true)
    try {
      // Estado atual do pedido alvo: última ordem + itens já referenciados.
      const { data: atuais } = await supabase
        .from('pedido_referencias')
        .select('trabalho_id, inspiracao_id, ordem')
        .eq('pedido_id', pedidoAlvo)
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
        pedido_id: pedidoAlvo,
        trabalho_id: it.origem === 'trabalho' ? it.id : null,
        inspiracao_id: it.origem === 'inspiracao' ? it.id : null,
        ordem: base + i,
      }))
      const { error } = await supabase.from('pedido_referencias').insert(linhas)
      if (error) return 'Falha ao salvar as referências: ' + error.message
      if (pedidoAlvo === pedidoId) await carregar()
      return null
    } finally {
      setSalvando(false)
    }
  }

  /**
   * M-048 · Copia as referências de uma proposta para um pedido recém-criado na
   * conversão (Decisão #32 = B1). Preserva as origens (trabalho/inspiração), a
   * `ordem` e a cópia pública já gerada (`foto_publica_path`) — assim o que a
   * proposta já subiu ao bucket público é reaproveitado (sem recopiar). Devolve
   * erro (ou null); a conversão trata como não-fatal (o pedido já foi criado).
   */
  async function copiarDaProposta(
    pedidoAlvo: string,
    propostaId: string
  ): Promise<string | null> {
    if (!usuariaId) return 'Sessão expirada. Entre de novo.'
    const { data, error } = await supabase
      .from('proposta_referencias')
      .select('trabalho_id, inspiracao_id, ordem, foto_publica_path')
      .eq('proposta_id', propostaId)
      .order('ordem', { ascending: true })
    if (error) return 'Falha ao ler as referências da proposta: ' + error.message
    if (!data || data.length === 0) return null
    const linhas = data.map((linha) => {
      const r = linha as {
        trabalho_id: string | null
        inspiracao_id: string | null
        ordem: number
        foto_publica_path: string | null
      }
      return {
        pedido_id: pedidoAlvo,
        trabalho_id: r.trabalho_id,
        inspiracao_id: r.inspiracao_id,
        ordem: r.ordem,
        foto_publica_path: r.foto_publica_path,
      }
    })
    const { error: insErro } = await supabase.from('pedido_referencias').insert(linhas)
    if (insErro) return 'Falha ao copiar as referências: ' + insErro.message
    if (pedidoAlvo === pedidoId) await carregar()
    return null
  }

  // ── Remove uma referência (atualização otimista) ──
  async function remover(id: string): Promise<string | null> {
    // M-047 · limpa a cópia pública gerada para o link (se houver) antes de
    // apagar a linha. Só a cópia gerada por nós vive em `foto_publica_path` da
    // própria referência — a cópia de vitrine do trabalho nunca é gravada aqui.
    const { data: alvo } = await supabase
      .from('pedido_referencias')
      .select('foto_publica_path')
      .eq('id', id)
      .maybeSingle()
    const { error } = await supabase.from('pedido_referencias').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    const copia = (alvo as { foto_publica_path: string | null } | null)?.foto_publica_path
    if (copia) await supabase.storage.from('publico').remove([copia])
    setReferencias((prev) => prev.filter((r) => r.id !== id))
    return null
  }

  /**
   * M-047 · Copia uma imagem de um bucket privado para o público, para aparecer
   * no link público do pedido (a cliente anônima não enxerga bucket privado).
   * Espelha `copiarParaPublico` da proposta (F2b). Devolve o caminho (ou null).
   */
  async function copiarParaPublico(bucket: string, pathPrivado: string): Promise<string | null> {
    if (!usuariaId) return null
    const { data, error } = await supabase.storage.from(bucket).download(pathPrivado)
    if (error || !data) return null
    const novo = `${usuariaId}/ped/${crypto.randomUUID()}.jpg`
    const { error: upErro } = await supabase.storage
      .from('publico')
      .upload(novo, data, { contentType: 'image/jpeg', upsert: false })
    if (upErro) return null
    return novo
  }

  /**
   * M-047 · Garante que TODA referência com imagem tenha um caminho público
   * antes de o link ser compartilhado (idempotente — só age no que falta):
   *   · trabalho já na vitrine  → reusa `trabalhos.foto_publica_path` (sem cópia);
   *   · trabalho fora da vitrine → copia de `acervo` p/ público;
   *   · inspiração com imagem   → copia de `inspiracoes` p/ público;
   *   · inspiração-link          → nada (aparece pelo `url`).
   * A cópia nova é gravada em `pedido_referencias.foto_publica_path`. Espelha o
   * mecanismo da proposta (F2b).
   *
   * BUG-011 · deixa de ser "melhor esforço" silencioso: se alguma cópia que
   * PRECISAVA subir falhou, devolve `{ erro }` para quem compartilha abortar o
   * envio (senão a cliente abriria o link com fotos quebradas). Devolve `null`
   * quando tudo o que precisava está pronto.
   */
  async function garantirFotosPublicas(pedidoAlvo: string): Promise<{ erro: string } | null> {
    const { data, error } = await supabase
      .from('pedido_referencias')
      .select(
        'id, foto_publica_path, trabalho_id, inspiracao_id, trabalhos(foto_path, foto_publica_path), inspiracoes(foto_path)'
      )
      .eq('pedido_id', pedidoAlvo)
    if (error) return { erro: 'Não consegui preparar as fotos do link. Tente de novo.' }
    let falhou = false
    for (const linha of (data ?? []) as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = linha as any
      if (r.foto_publica_path) continue // já tem cópia própria
      let novo: string | null = null
      if (r.trabalho_id) {
        if (r.trabalhos?.foto_publica_path) continue // reusa a cópia de vitrine
        if (r.trabalhos?.foto_path) {
          novo = await copiarParaPublico('acervo', r.trabalhos.foto_path)
          if (!novo) { falhou = true; continue }
        }
      } else if (r.inspiracao_id && r.inspiracoes?.foto_path) {
        novo = await copiarParaPublico('inspiracoes', r.inspiracoes.foto_path)
        if (!novo) { falhou = true; continue }
      }
      if (novo) {
        const { error: upErro } = await supabase
          .from('pedido_referencias')
          .update({ foto_publica_path: novo })
          .eq('id', r.id)
        if (upErro) falhou = true
      }
    }
    return falhou ? { erro: 'Algumas fotos do pedido não subiram. Tente compartilhar de novo.' } : null
  }

  return { referencias, carregando, salvando, listar: carregar, adicionar, copiarDaProposta, remover, garantirFotosPublicas }
}
