import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import {
  useCardapio,
  UNIDADES_SUGERIDAS,
  formatarReal,
  precoParaNumero,
  type CamposItem,
  type ItemCardapio,
} from '../hooks/useCardapio'

const FORM_VAZIO: CamposItem = {
  nome: '',
  preco_base: '',
  unidade: '',
  detalhes: '',
  na_vitrine: false,
  preco_sob_consulta: false,
}

/** Linha de apoio da lista: preço (R$ ou vazio) + unidade. */
function precoEUnidade(item: ItemCardapio): string {
  const preco = item.preco_base != null ? formatarReal(item.preco_base) : ''
  const unidade = item.unidade ? `por ${item.unidade}` : ''
  return [preco, unidade].filter(Boolean).join(' · ')
}

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
      unidade: item.unidade ?? '',
      detalhes: item.detalhes ?? '',
      na_vitrine: item.na_vitrine,
      preco_sob_consulta: item.preco_sob_consulta,
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
  const precoPreview = precoParaNumero(form.preco_base)

  return (
    <div className="tela">
      <BarraTopo titulo="Tabela de preços" />
      <div className="conteudo">
        {!formAberto && itens.length > 0 && (
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
              {precoPreview != null && (
                <div className="apoio" style={{ marginTop: 6 }}>
                  {formatarReal(precoPreview)}
                </div>
              )}
            </div>
            <div className="campo">
              <label>Unidade (opcional)</label>
              <input
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="Ex.: cento, dúzia, kg…"
                maxLength={40}
              />
              <div className="escolha" style={{ marginTop: 8 }}>
                {UNIDADES_SUGERIDAS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`filtro${form.unidade.trim().toLowerCase() === u ? ' ativo' : ''}`}
                    onClick={() => setForm({ ...form, unidade: u })}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="campo">
              <label>Detalhes (opcional)</label>
              <textarea
                value={form.detalhes}
                onChange={(e) => setForm({ ...form, detalhes: e.target.value })}
                placeholder="Ex.: recheio de ninho com nutella, mínimo 50 unidades"
                maxLength={300}
              />
            </div>

            <div className="cardapio-toggle">
              <div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icone nome="vitrine" size={16} /> Mostrar na vitrine</div>
                <div className="apoio" style={{ marginTop: 2 }}>
                  Aparece na tabela de preços pública da sua vitrine.
                </div>
              </div>
              <label className="interruptor">
                <input
                  type="checkbox"
                  checked={form.na_vitrine}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      na_vitrine: e.target.checked,
                      // Ao tirar da vitrine, zera o "sob consulta" (irrelevante fora dela).
                      preco_sob_consulta: e.target.checked && form.preco_sob_consulta,
                    })
                  }
                />
                <span className="pista" />
              </label>
            </div>

            {form.na_vitrine && (
              <div className="cardapio-toggle">
                <div>
                  <div style={{ fontWeight: 600 }}>Preço sob consulta</div>
                  <div className="apoio" style={{ marginTop: 2 }}>
                    Na vitrine aparece “Preço sob consulta” em vez do valor.
                  </div>
                </div>
                <label className="interruptor">
                  <input
                    type="checkbox"
                    checked={form.preco_sob_consulta}
                    onChange={(e) => setForm({ ...form, preco_sob_consulta: e.target.checked })}
                  />
                  <span className="pista" />
                </label>
              </div>
            )}

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
                <Icone nome="lixo" size={16} /> Excluir item
              </button>
            )}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="precos" size={44} /></div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div className="card-nome">{i.nome}</div>
                      {i.na_vitrine && (
                        <span className="chip-vitrine" title="Na vitrine"><Icone nome="vitrine" size={13} /> vitrine</span>
                      )}
                    </div>
                    {precoEUnidade(i) && <div className="apoio">{precoEUnidade(i)}</div>}
                    {i.detalhes && (
                      <div className="apoio" style={{ marginTop: 2 }}>{i.detalhes}</div>
                    )}
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
            <Icone nome="mais" /> Novo item
          </button>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo={`Excluir “${aExcluir.nome}”?`}
          descricao="Este item será removido da sua tabela de preços. Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir item"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  )
}
