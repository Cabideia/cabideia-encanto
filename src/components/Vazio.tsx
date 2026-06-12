type Props = {
  icone: string
  frase: string
  acao?: React.ReactNode
}

/** Padrão 8: estado vazio = ícone + 1 frase + 1 ação. */
export function Vazio({ icone, frase, acao }: Props) {
  return (
    <div className="vazio">
      <div className="icone" aria-hidden>
        {icone}
      </div>
      <p>{frase}</p>
      {acao}
    </div>
  )
}
