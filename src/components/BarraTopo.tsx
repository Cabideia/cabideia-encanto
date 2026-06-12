import { useNavigate } from 'react-router-dom'

type Props = {
  titulo: string
  voltar?: boolean
  acao?: React.ReactNode
}

/** Padrão 1 do design system: barra superior igual em todas as telas. */
export function BarraTopo({ titulo, voltar = true, acao }: Props) {
  const navegar = useNavigate()
  return (
    <div className="barra">
      {voltar ? (
        <button className="btn-icone" onClick={() => navegar(-1)} aria-label="Voltar">
          ←
        </button>
      ) : (
        <span className="vaga" />
      )}
      <div className="titulo">{titulo}</div>
      {acao ?? <span className="vaga" />}
    </div>
  )
}
