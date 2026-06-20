import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes, linkWhatsApp, type CamposCliente } from '../hooks/useClientes'

/** Item da tela de confirmação do import da agenda (M-031). */
type ItemImport = { nome: string; whatsapp: string; incluir: boolean }

/** M-003 · Clientes — lista com busca e botão WhatsApp a um toque. */
export function Clientes() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const navegar = useNavigate()
  const { clientes, carregando, salvando, criar, importar } = useClientes(sessao?.user.id)

  const [busca, setBusca] = useState('')
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CamposCliente>({ nome: '', whatsapp: '', nota: '' })

  // M-031 · Importar da agenda (Contact Picker API). Só Chrome Android / HTTPS.
  // Tudo atrás do feature-detect: navegador sem suporte nem renderiza o botão.
  const [suportaContatos, setSuportaContatos] = useState(false)
  const [importItens, setImportItens] = useState<ItemImport[] | null>(null)

  useEffect(() => {
    let vivo = true
    async function checar() {
      const nav = navigator as any
      if (!('contacts' in navigator) || !('ContactsManager' in window)) return
      try {
        const props: string[] = await nav.contacts.getProperties()
        if (vivo && Array.isArray(props) && props.includes('tel')) setSuportaContatos(true)
      } catch {
        /* sem suporte real → mantém escondido */
      }
    }
    checar()
    return () => {
      vivo = false
    }
  }, [])

  // No clique (gesto do usuário): abre o seletor nativo de contatos.
  async function importarDaAgenda() {
    try {
      const nav = navigator as any
      const selecionados: { name?: string[]; tel?: string[] }[] =
        await nav.contacts.select(['name', 'tel'], { multiple: true })
      if (!selecionados || selecionados.length === 0) return // cancelou / nada
      const itens: ItemImport[] = selecionados
        .map((c) => ({
          nome: (Array.isArray(c.name) ? c.name[0] : '') ?? '',
          whatsapp: (Array.isArray(c.tel) ? c.tel[0] : '') ?? '',
          incluir: true,
        }))
        .filter((i) => i.nome.trim()) // ignora entradas sem nome
      if (itens.length === 0) {
        avisar('Nenhum contato com nome foi selecionado')
        return
      }
      setImportItens(itens)
    } catch {
      avisar('Não foi possível abrir a agenda')
    }
  }

  function alterarItem(indice: number, mudanca: Partial<ItemImport>) {
    setImportItens((prev) =>
      prev ? prev.map((it, i) => (i === indice ? { ...it, ...mudanca } : it)) : prev
    )
  }

  async function confirmarImport() {
    if (!importItens) return
    const escolhidos = importItens
      .filter((i) => i.incluir && i.nome.trim())
      .map((i) => ({ nome: i.nome, whatsapp: i.whatsapp }))
    if (escolhidos.length === 0) {
      setImportItens(null)
      return
    }
    const res = await importar(escolhidos)
    if ('erro' in res) {
      avisar(res.erro)
      return
    }
    const partes = [
      `${res.adicionados} cliente${res.adicionados === 1 ? '' : 's'} adicionada${res.adicionados === 1 ? '' : 's'}`,
    ]
    if (res.pulados > 0) {
      partes.push(`${res.pulados} já existia${res.pulados === 1 ? '' : 'm'}`)
    }
    avisar(partes.join(' · '))
    setImportItens(null)
  }

  const totalIncluidos = importItens?.filter((i) => i.incluir && i.nome.trim()).length ?? 0

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
    avisar('Cliente salvo ✓')
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
            <Icone nome="busca" size={18} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome…"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cacau-claro)', lineHeight: 1, display: 'flex' }}
                aria-label="Limpar busca"
              >
                <Icone nome="fechar" size={18} />
              </button>
            )}
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="clientes" size={44} /></div>
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
                    {c.nome.trim().charAt(0).toUpperCase() || <Icone nome="clientes" size={18} />}
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
                      <Icone nome="whatsapp" size={16} /> WhatsApp
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {importItens && (
          <div className="form-acervo">
            <div className="form-acervo-titulo">Importar da agenda</div>
            <p className="apoio" style={{ marginTop: -4, marginBottom: 8 }}>
              {totalIncluidos} selecionada{totalIncluidos === 1 ? '' : 's'} · revise nome e WhatsApp antes de salvar
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {importItens.map((item, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ opacity: item.incluir ? 1 : 0.55, display: 'flex', gap: 10, alignItems: 'flex-start' }}
                >
                  <input
                    type="checkbox"
                    checked={item.incluir}
                    onChange={(e) => alterarItem(i, { incluir: e.target.checked })}
                    aria-label={`Incluir ${item.nome || 'contato'}`}
                    style={{ width: 20, height: 20, marginTop: 6, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      value={item.nome}
                      onChange={(e) => alterarItem(i, { nome: e.target.value })}
                      placeholder="Nome"
                      maxLength={80}
                      disabled={!item.incluir}
                    />
                    <input
                      value={item.whatsapp}
                      onChange={(e) => alterarItem(i, { whatsapp: e.target.value })}
                      placeholder="WhatsApp (opcional)"
                      inputMode="tel"
                      disabled={!item.incluir}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => setImportItens(null)} className="btn-secundario" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImport}
                disabled={salvando || totalIncluidos === 0}
                className="cta"
                style={{ flex: 2, height: 48 }}
              >
                {salvando ? 'Salvando…' : `Adicionar ${totalIncluidos}`}
              </button>
            </div>
          </div>
        )}

        {formAberto && (
          <div className="form-acervo">
            <div className="form-acervo-titulo">Novo cliente</div>
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

      {!formAberto && !importItens && (
        <div className="cta-area">
          {suportaContatos && (
            <button className="btn-secundario" onClick={importarDaAgenda} style={{ marginBottom: 8 }}>
              <Icone nome="clientes" size={18} /> Importar da agenda
            </button>
          )}
          <button className="cta" onClick={() => setFormAberto(true)}>
            <Icone nome="mais" /> Novo cliente
          </button>
        </div>
      )}
    </div>
  )
}
