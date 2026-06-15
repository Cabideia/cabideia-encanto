import { useState } from 'react'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useSelecoes, type Selecao } from '../hooks/useSelecoes'

/**
 * M-020 · Etapa 1 — Minhas seleções.
 * Lista as seleções criadas, permite reenviar/copiar o link e apagar
 * (apagar = revogar o acesso na hora, pois a página pública deixa de achar).
 */
function diasRestantes(expira: string): number {
  const ms = new Date(expira).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export function MinhasSelecoes() {
  const { sessao } = useSessao()
  const avisar = useAviso()
  const { selecoes, carregando, apagar } = useSelecoes(sessao?.user.id)
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

  if (carregando) return null

  return (
    <div className="tela">
      <BarraTopo titulo="Minhas seleções" />
      <div className="conteudo">
        <p className="apoio" style={{ marginBottom: 12 }}>
          Links que você montou para clientes. Cada um vale 30 dias. Apagar faz o
          link parar de funcionar na hora.
        </p>

        {selecoes.length === 0 ? (
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone">🔗</div>
            <p>
              Você ainda não criou seleções. Em “Meus trabalhos”, toque em
              Compartilhar para montar uma.
            </p>
          </div>
        ) : (
          selecoes.map((s) => {
            const dias = diasRestantes(s.expira_em)
            const expirada = dias === 0
            return (
              <div className="card" key={s.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div className="card-info">
                    <div className="card-nome">{s.titulo || 'Seleção sem título'}</div>
                    <div className="apoio">
                      {s.qtd} foto{s.qtd !== 1 ? 's' : ''} ·{' '}
                      {expirada ? 'expirada' : `expira em ${dias} dia${dias !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="btn-secundario"
                    style={{ flex: 1, opacity: expirada ? 0.5 : 1 }}
                    onClick={() => !expirada && compartilhar(s)}
                    disabled={expirada}
                  >
                    📤 Enviar de novo
                  </button>
                  <button
                    className="btn-icone"
                    onClick={() => setAApagar(s)}
                    aria-label="Apagar seleção"
                    style={{ background: 'var(--neutro-suave)' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {aApagar && (
        <Confirmar
          titulo="Apagar esta seleção?"
          descricao="O link enviado à cliente vai parar de funcionar imediatamente. Suas fotos continuam guardadas no acervo."
          rotuloConfirmar="Apagar seleção"
          onConfirmar={confirmarApagar}
          onCancelar={() => setAApagar(null)}
        />
      )}
    </div>
  )
}
