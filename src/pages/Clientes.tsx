import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp, type CamposCliente } from '../hooks/useClientes'

/** M-003 · Clientes — lista com busca e botão WhatsApp a um toque. */
export function Clientes() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()
  const { clientes, carregando, salvando, criar } = useClientes(sessao?.user.id)

  const [busca, setBusca] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

  const filtrados = clientes.filter(
    (c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function fecharForm() {
    setFormAberto(false)
    setForm({ nome: '', whatsapp: '', nota: '' })
  }

  async function salvar() {
    const res = await criar(form)
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    avisar('Cliente salva ✓')
    fecharForm()
  }

  function abrirWhatsApp(e: React.MouseEvent, cliente: { nome: string; whatsapp: string | null }) {
    e.stopPropagation()
    const link = linkWhatsApp(cliente)
    if (!link) {
      avisar('Esta cliente não tem WhatsApp cadastrado')
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Clientes" />
      <div className="conteudo">
        {clientes.length > 0 && (
          <div className="busca" style={{ marginTop: 4 }}>
            🔎
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome…"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cacau-claro)', fontSize: 16, lineHeight: 1 }}
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🩷</div>
            <p>
              {busca
                ? 'Nenhuma cliente encontrada com esse nome.'
                : 'Suas clientes ficam aqui, com o WhatsApp a um toque.'}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {filtrados.map((c) => (
              <div
                key={c.id}
                className="card card-toque"
                onClick={() => navegar(`/clientes/${c.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navegar(`/clientes/${c.id}`)}
              >
                <div className="card-linha">
                  <div className="bola" aria-hidden>
                    {c.nome.trim().charAt(0).toUpperCase() || '🩷'}
                  </div>
                  <div className="card-info">
                    <div className="card-nome">{c.nome}</div>
                    <div className="apoio">
                      {c.whatsapp ? c.whatsapp : 'sem WhatsApp'}
                    </div>
                  </div>
                  {c.whatsapp && (
                    <button
                      className="zap"
                      onClick={(e) => abrirWhatsApp(e, c)}
                      aria-label={`Abrir WhatsApp de ${c.nome}`}
                    >
                      💬 WhatsApp
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {formAberto && (
          <div className="form-acervo">
            <div className="form-acervo-titulo">Nova cliente</div>
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
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={fecharForm} className="btn-secundario" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || !form.nome.trim()}
                className="cta"
                style={{ flex: 2, height: 48 }}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!formAberto && (
        <div className="cta-area">
          <button className="cta" onClick={() => setFormAberto(true)}>
            ＋ Novo cliente
          </button>
        </div>
      )}
    </div>
  )
}
