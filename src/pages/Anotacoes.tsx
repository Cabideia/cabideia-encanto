import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useAnotacoes, type Anotacao } from '../hooks/useAnotacoes'

/** Ex.: "16 de jun., 09:50" */
function quando(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** M-008 · Anotações — bloco de texto livre (lista + editor). */
export function Anotacoes() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { anotacoes, carregando, salvando, criar, atualizar, excluir } = useAnotacoes(sessao?.user.id)

  // null = fechado · 'nova' = criando · string(id) = editando
  const [editandoId, setEditandoId] = useState<string | 'nova' | null>(null)
  const [texto, setTexto] = useState('')
  const [aExcluir, setAExcluir] = useState<Anotacao | null>(null)

  function abrirNova() {
    setTexto('')
    setEditandoId('nova')
  }

  function abrirEdicao(a: Anotacao) {
    setTexto(a.texto)
    setEditandoId(a.id)
  }

  function fecharForm() {
    setEditandoId(null)
    setTexto('')
  }

  async function salvar() {
    if (editandoId === 'nova') {
      const res = await criar(texto)
      if ('erro' in res) return avisar(res.erro)
      avisar('Anotação salva ✓')
    } else if (editandoId) {
      const erro = await atualizar(editandoId, texto)
      if (erro) return avisar(erro)
      avisar('Anotação atualizada ✓')
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
    avisar('Anotação excluída')
    if (editandoId === aExcluir.id) fecharForm()
    setAExcluir(null)
  }

  if (carregando) return null

  const formAberto = editandoId !== null

  return (
    <div className="tela">
      <BarraTopo titulo="Anotações" />
      <div className="conteudo">
        {formAberto ? (
          <div className="form-acervo">
            <div className="form-acervo-titulo">
              {editandoId === 'nova' ? 'Nova anotação' : 'Editar anotação'}
            </div>
            <div className="campo">
              <label>Texto</label>
              <textarea
                autoFocus
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Suas ideias e lembretes…"
                style={{ minHeight: 160 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={fecharForm} className="btn-secundario" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || !texto.trim()}
                className="cta"
                style={{ flex: 2, height: 48 }}
              >
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
            {editandoId !== 'nova' && (
              <button
                className="btn-secundario"
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                onClick={() => {
                  const a = anotacoes.find((x) => x.id === editandoId)
                  if (a) setAExcluir(a)
                }}
              >
                <Icone nome="lixo" size={16} /> Excluir anotação
              </button>
            )}
          </div>
        ) : anotacoes.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="anotacoes" size={44} /></div>
            <p>Um lugar simples para suas ideias e lembretes.</p>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {anotacoes.map((a) => (
              <div
                key={a.id}
                className="card card-toque"
                onClick={() => abrirEdicao(a)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && abrirEdicao(a)}
              >
                <p style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{a.texto}</p>
                <div className="apoio" style={{ marginTop: 8 }}>{quando(a.atualizado_em)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!formAberto && (
        <div className="cta-area">
          <button className="cta" onClick={abrirNova}>
            <Icone nome="mais" /> Nova anotação
          </button>
        </div>
      )}

      {aExcluir && (
        <Confirmar
          titulo="Excluir anotação?"
          descricao="Esta anotação será removida. Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir anotação"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  )
}
