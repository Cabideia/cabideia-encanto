/**
 * Modal de confirmação para ações destrutivas (apagar foto, apagar tag).
 * Reutilizável: recebe título, descrição e o rótulo do botão de confirmar.
 * Sempre apresenta "Cancelar" primeiro (mais fácil de acertar por engano).
 */
type Props = {
  titulo: string
  descricao?: string
  rotuloConfirmar?: string
  /** Ação destrutiva (vermelho). Default true — as 16 chamadas destrutivas que já existem continuam iguais. */
  perigo?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export function Confirmar({
  titulo,
  descricao,
  rotuloConfirmar = 'Apagar',
  perigo = true,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <div className="confirmar-overlay" onClick={onCancelar}>
      <div
        className="confirmar-caixa"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label={titulo}
      >
        <div className="confirmar-titulo">{titulo}</div>
        {descricao && <p className="confirmar-desc">{descricao}</p>}
        <div className="confirmar-botoes">
          <button type="button" className="btn-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={perigo ? 'confirmar-perigo' : 'confirmar-ok'}
            onClick={onConfirmar}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

