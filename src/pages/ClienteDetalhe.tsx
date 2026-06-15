import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp, type CamposCliente } from '../hooks/useClientes'

/** M-003 · Detalhe da cliente — ver, editar, excluir + pedidos (stub M-002). */
export function ClienteDetalhe() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { carregando, salvando, buscarPorId, atualizar, excluir } = useClientes(sessao?.user.id)

  const cliente = id ? buscarPorId(id) : undefined

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })
  const [aExcluir, setAExcluir] = useState(false)

  // Preenche o formulário quando a cliente carrega/muda.
  useEffect(() => {
    if (cliente) {
      setForm({
        nome: cliente.nome,
        whatsapp: cliente.whatsapp ?? '',
        nota: cliente.nota ?? '',
      })
    }
  }, [cliente])

  if (carregando) return null

  // Carregou mas não achou (link antigo ou cliente já excluída).
  if (!cliente) {
    return (
      <div className="tela">
        <BarraTopo titulo="Cliente" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🔍</div>
            <p>Esta cliente não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  function abrirWhatsApp() {
    const link = linkWhatsApp(cliente!)
    if (!link) {
      avisar('Esta cliente não tem WhatsApp cadastrado')
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  async function salvar() {
    const erro = await atualizar(cliente!.id, form)
    if (erro) {
      avisar(erro)
      return
    }
    avisar('Cliente atualizada ✓')
    setEditando(false)
  }

  async function confirmarExcluir() {
    const erro = await excluir(cliente!.id)
    if (erro) {
      avisar(erro)
      setAExcluir(false)
      return
    }
    avisar('Cliente excluída')
    navegar('/clientes', { replace: true })
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo={editando ? 'Editar cliente' : cliente.nome}
        acao={
          !editando ? (
            <button className="btn-icone" onClick={() => setEditando(true)} aria-label="Editar cliente">
              ✏️
            </button>
          ) : undefined
        }
      />

      <div className="conteudo">
        {editando ? (
          <>
            <div className="campo">
              <label>Nome</label>
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Maria Silva"
                maxLength={80}
              />
            </div>
            <div className="campo">
              <label>WhatsApp (opcional)</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="Ex.: +55 11 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="campo">
              <label>Nota (opcional)</label>
              <textarea
                value={form.nota}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
                placeholder="Ex.: prefere entregas pela manhã"
                maxLength={300}
              />
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="card-linha">
                <div className="bola" aria-hidden>
                  {cliente.nome.trim().charAt(0).toUpperCase() || '🩷'}
                </div>
                <div className="card-info">
                  <div className="card-nome">{cliente.nome}</div>
                  <div className="apoio">{cliente.whatsapp ?? 'sem WhatsApp'}</div>
                </div>
              </div>
              {cliente.whatsapp && (
                <button className="cta" style={{ marginTop: 14, height: 48 }} onClick={abrirWhatsApp}>
                  💬 Abrir conversa no WhatsApp
                </button>
              )}
            </div>

            {cliente.nota && (
              <>
                <div className="secao"><span className="confeito" /><h2>Nota</h2></div>
                <div className="card">
                  <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{cliente.nota}</p>
                </div>
              </>
            )}

            {/* Pedidos — stub reservado (será preenchido em M-002). */}
            <div className="secao"><span className="confeito" /><h2>Pedidos</h2></div>
            <div className="card">
              <p className="apoio" style={{ textAlign: 'center', padding: '8px 0' }}>
                🧁 Os pedidos desta cliente aparecerão aqui.
              </p>
            </div>

            <button
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={() => setAExcluir(true)}
            >
              🗑️ Excluir cliente
            </button>
          </>
        )}
      </div>

      {/* CTA primário fixo só no modo edição (Salvar). */}
      {editando && (
        <div className="cta-area">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-secundario"
              style={{ flex: 1 }}
              onClick={() => setEditando(false)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="cta"
              style={{ flex: 2 }}
              onClick={salvar}
              disabled={salvando || !form.nome.trim()}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo={`Excluir “${cliente.nome}”?`}
          descricao="Os dados desta cliente serão removidos. Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir cliente"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}
    </div>
  )
}
