import { VERSAO } from '../lib/versao'

/**
 * Selo de versão discreto (pedido da Josiane). Mostra a versão do bundle que
 * está de fato rodando — assim ela confirma, no próprio device, que o deploy
 * novo já está ativo antes de testar. Ver src/lib/versao.ts.
 *
 * Fica no rodapé das Configurações e da tela de login (esta é pública, dá para
 * conferir sem entrar). `title` mostra o texto completo ao toque prolongado.
 */
export function VersaoApp() {
  return (
    <p className="versao-app" title={VERSAO}>
      {VERSAO}
    </p>
  )
}
