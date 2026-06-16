import { useOnline } from '../lib/conexao'

/**
 * M-023 · Banner global de leitura offline.
 *
 * Aparece no topo quando o navegador está offline e some ao voltar a conexão.
 * É o aviso explícito que a PO pediu: deixa claro que dá para ver os dados
 * salvos, mas que criar ou editar precisa de internet.
 */
export function AvisoOffline() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="aviso-offline" role="status">
      <span aria-hidden>📴</span>
      <span>
        Você está offline. Mostrando dados salvos. Para criar ou editar,
        conecte-se à internet.
      </span>
    </div>
  )
}
