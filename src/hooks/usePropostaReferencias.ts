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
    // F2b · limpa a cópia pública gerada para o link (se houver) antes de apagar
    // a linha. Só a cópia gerada por nós vive em `foto_publica_path` da própria
    // referência — a cópia de vitrine do trabalho nunca é gravada aqui.
    const { data: alvo } = await supabase
      .from('proposta_referencias')
      .select('foto_publica_path')
      .eq('id', id)
      .maybeSingle()
    const { error } = await supabase.from('proposta_referencias').delete().eq('id', id)
    if (error) return 'Falha ao remover: ' + error.message
    const copia = (alvo as { foto_publica_path: string | null } | null)?.foto_publica_path
    if (copia) await supabase.storage.from('publico').remove([copia])
    setReferencias((prev) => prev.filter((r) => r.id !== id))
    return null
  }

  /**
   * F2b · Copia uma imagem de um bucket privado para o público, para aparecer no
   * link público da proposta (a cliente anônima não enxerga bucket privado).
   * Espelha `copiarParaPublico` do M-022. Devolve o caminho público (ou null).
   */
  async function copiarParaPublico(bucket: string, pathPrivado: string): Promise<string | null> {
    if (!usuariaId) return null
    const { data, error } = await supabase.storage.from(bucket).download(pathPrivado)
    if (error || !data) return null
    const novo = `${usuariaId}/prop/${crypto.randomUUID()}.jpg`
    const { error: upErro } = await supabase.storage
      .from('publico')
      .upload(novo, data, { contentType: 'image/jpeg', upsert: false })
    if (upErro) return null
    return novo
  }

  /**
   * F2b · Garante que TODA referência com imagem tenha um caminho público antes
   * de o link ser compartilhado (idempotente — só age no que falta):
   *   · trabalho já na vitrine  → reusa `trabalhos.foto_publica_path` (sem cópia);
   *   · trabalho fora da vitrine → copia de `acervo` p/ público;
   *   · inspiração com imagem   → copia de `inspiracoes` p/ público;
   *   · inspiração-link          → nada (aparece pelo `url`).
   * A cópia nova é gravada em `proposta_referencias.foto_publica_path`.
   *
   * BUG-011 · deixa de ser "melhor esforço" silencioso: se alguma cópia que
   * PRECISAVA subir falhou, devolve `{ erro }` para quem compartilha abortar o
   * envio (senão a cliente abriria o link com fotos quebradas). Devolve `null`
   * quando tudo o que precisava está pronto.
   */
  async function garantirFotosPublicas(propostaId: string): Promise<{ erro: string } | null> {
    if (estaOffline()) return { erro: SEM_CONEXAO }
    const { data, error } = await supabase
      .from('proposta_referencias')
      .select(
        'id, foto_publica_path, trabalho_id, inspiracao_id, trabalhos(foto_path, foto_publica_path), inspiracoes(foto_path)'
      )
      .eq('proposta_id', propostaId)
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
          .from('proposta_referencias')
          .update({ foto_publica_path: novo })
          .eq('id', r.id)
        if (upErro) falhou = true
      }
    }
    return falhou ? { erro: 'Algumas fotos da proposta não subiram. Tente compartilhar de novo.' } : null
  }

  return { referencias, carregando, salvando, listar: carregar, adicionar, remover, garantirFotosPublicas }
}
