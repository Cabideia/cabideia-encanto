import { useSessao } from '../hooks/useSessao'
import { useTema } from '../hooks/useTema'
import { TEMAS, ROTULO_TEMA, type Tema } from '../lib/tema'
import { Icone } from './Icone'

/**
 * Seletor de tema (Decisão #9). Três opções; só a cor muda. A escolha grava em
 * `perfis.tema` e repinta o app na hora — e vale também nas páginas públicas.
 */

// Amostras (primária · acento · fundo) só para a prévia do cartão — espelham
// os tokens de tokens.css.
const AMOSTRA: Record<Tema, { primaria: string; acento: string; fundo: string }> = {
  oficina: { primaria: '#A8503A', acento: '#6E8B5B', fundo: '#F2EBDF' },
  vitrine: { primaria: '#1F6F6B', acento: '#C9A24B', fundo: '#F4F2EE' },
  encanto: { primaria: '#6E3D5B', acento: '#C98A3A', fundo: '#F3EDE6' },
}

const SUBTITULO: Record<Tema, string> = {
  oficina: 'a cara da casa',
  vitrine: 'sóbrio e elegante',
  encanto: 'delicado e marcante',
}

export function SeletorTema() {
  const { sessao } = useSessao()
  const { tema, definir, salvando } = useTema(sessao?.user.id)

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-nome" style={{ fontSize: 'var(--t-base)' }}>Identidade visual</div>
      <p className="apoio" style={{ marginTop: 2, marginBottom: 12 }}>
        Escolha as cores da sua vitrine e do app. A tipografia continua a mesma.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {TEMAS.map((t) => {
          const a = AMOSTRA[t]
          const ativo = tema === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => !salvando && definir(t)}
              disabled={salvando}
              aria-pressed={ativo}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '12px 6px', cursor: 'pointer', font: 'inherit',
                background: a.fundo, color: 'var(--cacau)',
                border: `2px solid ${ativo ? a.primaria : 'var(--linha)'}`,
                borderRadius: 14, position: 'relative',
              }}
            >
              <span style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: a.primaria }} />
                <span style={{ width: 14, height: 14, borderRadius: 4, background: a.acento, alignSelf: 'flex-end' }} />
              </span>
              <span style={{ fontWeight: 800, fontSize: 'var(--t-apoio)' }}>{ROTULO_TEMA[t]}</span>
              <span className="apoio" style={{ fontSize: 11, lineHeight: 1.2, textAlign: 'center' }}>
                {SUBTITULO[t]}
              </span>
              {ativo && (
                <span style={{
                  position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%',
                  background: a.primaria, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icone nome="ok" size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
