import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useSelecoes, type Selecao } from '../hooks/useSelecoes'
import { usePropostas } from '../hooks/usePropostas'
import { useClientes } from '../hooks/useClientes'
import { formatarReal } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'

/**
 * M-037 · Acompanhar — links e propostas num lugar só.
 *
 * Duas abas:
 *  • "Links"     → o que "Minhas seleções" fazia (validade 30 dias, "Enviar de
 *                  novo", lixeira). "Minhas seleções" perde a porta própria e
 *                  passa a ser esta aba.
 *  • "Propostas" → todas as propostas (antes viviam dentro de cada cliente).
 *
 * Em cada item, "Marcar como resolvido" ARQUIVA (resolvida=true) e some da aba
 * ativa — reversível pelo filtro "Resolvidos" ("Reabrir"). É diferente da
 * lixeira: resolver arquiva; a lixeira mata o link na hora (comportamento atual).
 */
function diasRestantes(expira: string): number {
  const ms = new Date(expira).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

type Aba = 'links' | 'propostas'

export function Acompanhar() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()

  const { selecoes, carregando: carregandoSel, apagar, marcarResolvida: resolverSelecao } =
    useSelecoes(sessao?.user.id)
  const { propostas, carregando: carregandoProp, marcarResolvida: resolverProposta } =
    usePropostas(sessao?.user.id)
  const { buscarPorId: buscarCliente } = useClientes(sessao?.user.id)

  const [aba, setAba] = useState<Aba>('links')
  const [verResolvidos, setVerResolvidos] = useState(false)
  const [aApagar, setAApagar] = useState<Selecao | null>(null)

  function linkDe(token: string) {
    return `https://cabideia.com.br/encanto/s/${token}`
  }

  async function compartilhar(s: Selecao) {
    const url = linkDe(s.token)
    const texto = `${s.mensagem ? s.mensagem + ' ' : ''}${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title: s.titulo ?? 'Seleção', text: texto, url })
      } catch {
        /* cancelou */
      }
    } else {
      navigator.clipboard?.writeText(url)
      avisar('Link copiado ✓')
    }
  }

  async function confirmarApagar() {
    if (!aApagar) return
    const erro = await apagar(aApagar.id)
    avisar(erro ?? 'Seleção apagada — o link parou de funcionar')
    setAApagar(null)
  }

  async function alternarResolvidoSelecao(s: Selecao) {
    const erro = await resolverSelecao(s.id, !s.resolvida)
    if (erro) avisar(erro)
    else avisar(s.resolvida ? 'Reaberto ✓' : 'Marcado como resolvido ✓')
  }

  async function alternarResolvidoProposta(id: string, resolvida: boolean) {
    const erro = await resolverProposta(id, !resolvida)
    if (erro) avisar(erro)
    else avisar(resolvida ? 'Reaberto ✓' : 'Marcado como resolvido ✓')
  }

  const carregando = aba === 'links' ? carregandoSel : carregandoProp

  const selecoesFiltradas = selecoes.filter((s) => s.resolvida === verResolvidos)
  const propostasFiltradas = propostas.filter((p) => p.resolvida === verResolvidos)

  return (
    <div className="tela">
      <BarraTopo titulo="Acompanhar" />
      <div className="conteudo">
        {/* Abas principais: Links · Propostas */}
        <div className="escolha">
          <button
            type="button"
            className={`filtro${aba === 'links' ? ' ativo' : ''}`}
            onClick={() => setAba('links')}
          >
            <Icone nome="link" size={15} /> Links
          </button>
          <button
            type="button"
            className={`filtro${aba === 'propostas' ? ' ativo' : ''}`}
            onClick={() => setAba('propostas')}
          >
            <Icone nome="editar" size={15} /> Propostas
          </button>
        </div>

        {/* Filtro: ativos · resolvidos */}
        <div className="escolha" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={`filtro${!verResolvidos ? ' ativo' : ''}`}
            onClick={() => setVerResolvidos(false)}
          >
            Ativos
          </button>
          <button
            type="button"
            className={`filtro${verResolvidos ? ' ativo' : ''}`}
            onClick={() => setVerResolvidos(true)}
          >
            Resolvidos
          </button>
        </div>

        {carregando ? null : aba === 'links' ? (
          <>
            <p className="apoio" style={{ margin: '12px 0' }}>
              {verResolvidos
                ? 'Links arquivados. Reabra para voltar à lista de ativos.'
                : 'Links que você montou para clientes. Cada um vale 30 dias. Apagar faz o link parar de funcionar na hora; resolver só arquiva.'}
            </p>

            {selecoesFiltradas.length === 0 ? (
              <div className="vazio" style={{ marginTop: 16 }}>
                <div className="icone"><Icone nome="link" size={44} /></div>
                <p>
                  {verResolvidos
                    ? 'Nenhum link resolvido por aqui.'
                    : 'Você ainda não criou links. Em “Meus trabalhos”, toque em Selecionar para montar um.'}
                </p>
              </div>
            ) : (
              selecoesFiltradas.map((s) => {
                const dias = diasRestantes(s.expira_em)
                const expirada = dias === 0
                return (
                  <div className="card" key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div className="card-info">
                        <div className="card-nome">{s.titulo || 'Seleção sem título'}</div>
                        <div className="apoio">
                          {s.qtd} {s.qtd !== 1 ? 'itens' : 'item'} ·{' '}
                          {expirada ? 'expirada' : `expira em ${dias} dia${dias !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    </div>
                    {!verResolvidos && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          className="btn-secundario"
                          style={{ flex: 1, opacity: expirada ? 0.5 : 1 }}
                          onClick={() => !expirada && compartilhar(s)}
                          disabled={expirada}
                        >
                          <Icone nome="enviar" size={16} /> Enviar de novo
                        </button>
                        <button
                          className="btn-icone"
                          onClick={() => setAApagar(s)}
                          aria-label="Apagar seleção"
                          style={{ background: 'var(--neutro-suave)' }}
                        >
                          <Icone nome="lixo" />
                        </button>
                      </div>
                    )}
                    <button
                      className="btn-secundario"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      onClick={() => alternarResolvidoSelecao(s)}
                    >
                      {s.resolvida ? (
                        <><Icone nome="recarregar" size={16} /> Reabrir</>
                      ) : (
                        <><Icone nome="ok" size={16} /> Marcar como resolvido</>
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </>
        ) : (
          <>
            <p className="apoio" style={{ margin: '12px 0' }}>
              {verResolvidos
                ? 'Propostas arquivadas. Reabra para voltar à lista de ativas.'
                : 'Todas as suas propostas num lugar só. Toque para abrir e compartilhar.'}
            </p>

            {propostasFiltradas.length === 0 ? (
              <div className="vazio" style={{ marginTop: 16 }}>
                <div className="icone"><Icone nome="editar" size={44} /></div>
                <p>
                  {verResolvidos
                    ? 'Nenhuma proposta resolvida por aqui.'
                    : 'Você ainda não criou propostas. Abra uma cliente para criar a primeira.'}
                </p>
              </div>
            ) : (
              propostasFiltradas.map((p) => {
                const cliente = p.cliente_id ? buscarCliente(p.cliente_id) : undefined
                return (
                  <div className="card" key={p.id}>
                    <div
                      className="card-toque"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'none', border: 'none', padding: 0, margin: 0 }}
                      onClick={() => navegar(`/propostas/${p.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navegar(`/propostas/${p.id}`)}
                    >
                      <div className="card-info">
                        <div className="card-nome" style={{ whiteSpace: 'normal' }}>
                          {p.titulo || 'Proposta'}
                        </div>
                        <div className="apoio">
                          {cliente?.nome ?? 'sem cliente'}
                          {' · '}
                          {p.valor != null ? formatarReal(p.valor) : 'Valor a combinar'}
                          {p.validade ? ` · vale até ${formatarDataNumerica(p.validade)}` : ''}
                        </div>
                      </div>
                      <span aria-hidden>›</span>
                    </div>
                    <button
                      className="btn-secundario"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      onClick={() => alternarResolvidoProposta(p.id, p.resolvida)}
                    >
                      {p.resolvida ? (
                        <><Icone nome="recarregar" size={16} /> Reabrir</>
                      ) : (
                        <><Icone nome="ok" size={16} /> Marcar como resolvido</>
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {aApagar && (
        <Confirmar
          titulo="Apagar esta seleção?"
          descricao="O link enviado à cliente vai parar de funcionar imediatamente. Suas fotos continuam guardadas em Meus Trabalhos."
          rotuloConfirmar="Apagar seleção"
          onConfirmar={confirmarApagar}
          onCancelar={() => setAApagar(null)}
        />
      )}
    </div>
  )
}
