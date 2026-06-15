import { useNavigate } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { PerfilForm } from '../components/PerfilForm'

/**
 * M-017 · Etapa 1 — Perfil da dona (base da vitrine pública).
 *
 * A lógica de leitura/gravação em `perfis` mora em <PerfilForm>, que também é
 * reaproveitado pelo sheet de edição inline na Minha Vitrine.
 */
export function Perfil() {
  const navegar = useNavigate()

  return (
    <div className="tela">
      <BarraTopo titulo="Meu perfil" />
      <div className="conteudo">
        <PerfilForm onSalvo={() => navegar('/vitrine')} />
      </div>
    </div>
  )
}
