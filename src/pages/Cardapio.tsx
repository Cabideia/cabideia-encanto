import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import {
  useCardapio,
  UNIDADES,
  rotuloUnidade,
  formatarReal,
  type CamposItem,
  type ItemCardapio,
} from '../hooks/useCardapio'

const FORM_VAZIO: CamposItem = { nome: '', preco_base: '', unidade: 'unidade' }

/** M-015 · Cardápio — prateleira de referência (produto + preço base), sem vínculo com pedido. */
export function Cardapio() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { itens, carregando, salvando, criar, atualizar, excluir } = useCardapio(sessao?.user.id)

  const [busca, setBusca] = useState('')
  // null = fechado · 'novo' = criando · string(id) = editando
  const [editandoId, setEditandoId] = useState<string | 'novo' | null>(null)
  const [form, setForm] = useState<CamposItem>(FORM_VAZIO)
  const [aExcluir, setAExcluir] = useState<ItemCardapio | null>(null)

  const filtrados = itens.filter(
    (i) => !busca || i.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNovo() {
    setForm(FORM_VAZIO)
    setEditandoId('novo')
  }

  function abrirEdicao(item: ItemCardapio) {
    setForm({
      nome: item.nome,
      preco_base: item.preco_base != null ? String(item.preco_base).replace('.', ',') : '',
      unidade: item.unidade,
    })
    setEditandoId(item.id)
  }

  function fecharForm() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
  }

  async function salvar() {
    if (editandoId === 'novo') {
      const res = await criar(form)
      if ('erro' in res) return avisar(res.erro)
      avisar('Item salvo ✓')
    } else if (editandoId) {
      const erro = await atualizar(editandoId, form)
      if (erro) return avisar(erro)
      avisar('Item atualizado ✓')
    }
    fecharForm()
  }

  async function confirmarExcluir() {
    if (!aExcluir) return
    const erro = await excluir(aExcluir.id)
    if (erro) {
      avisar(erro)
      setAExcluir(null)
      return
    }
    avisar('Item excluído')
    if (editandoId === aExcluir.id) fecharForm()
    setAExcluir(null)
  }

  if (carregando) return null

  const formAberto = editandoId !== null

  return (
    <div className="tela">
      <BarraTopo titulo="Cardápio" />
      <div className="conteudo">
        {!formAberto && itens.length > 0 && (
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

        {formAberto ? (
          <div className="form-acervo">
            <div className="form-acervo-titulo">
              {editandoId === 'novo' ? 'Novo item' : 'Editar item'}
            </div>
            <div className="campo">
              <label>Nome</label>
              <input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Brigadeiro gourmet"
                maxLength={80}
              />
            </div>
            <div className="campo">
              <label>Preço base (opcional)</label>
              <input
                value={form.preco_base}
                onChange={(e) => setForm({ ...form, preco_base: e.target.value })}
                placeholder="Ex.: 3,50"
                inputMode="decimal"
              />
            </div>
            <div className="campo">
              <label>Unidade</label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value as CamposItem['unidade'] })}
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.rotulo}
                  </option>
                ))}
              </select>
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
            {editandoId !== 'novo' && (
              <button
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => {
                  const item = itens.find((i) => i.id === editandoId)
                  if (item) setAExcluir(item)
                }}
              >
                🗑️ Excluir item
              </button>
            )}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">📋</div>
            <p>
              {busca
                ? 'Nenhum item encontrado com esse nome.'
                : 'Seus produtos e preços de referência, para consultar rapidinho.'}
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {filtrados.map((i) => (
              <div
                key={i.id}
                className="card card-toque"
                onClick={() => abrirEdicao(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && abrirEdicao(i)}
              >
                <div className="card-linha">
                  <div className="card-info">
                    <div className="card-nome">{i.nome}</div>
                    <div className="apoio">
                      {i.preco_base != null
                        ? `${formatarReal(i.preco_base)} / ${rotuloUnidade(i.unidade)}`
                        : `por ${rotuloUnidade(i.unidade)}`}
                    </div>
                  </div>
                  <span aria-hidden>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!formAberto && (
        <div className="cta-area">
          <button className="cta" onClick={abrirNovo}>
            ＋ Novo item
          </button>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo={`Excluir “${aExcluir.nome}”?`}
          descricao="Este item será removido do seu cardápio. Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir item"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  )
}
