import { LegalLayout } from '../components/LegalLayout'

/**
 * Página pública /excluir-conta (cabideia.com.br/encanto/excluir-conta).
 *
 * Sem login e sem barra inferior. Atende às exigências do Google Play de URL
 * pública para exclusão de conta e exclusão de dados. Mesma abordagem visual
 * das páginas /privacidade e /termos.
 */
export function ExcluirConta() {
  return (
    <LegalLayout titulo="Exclusão de conta e dados">
      <h1>Exclusão de conta e dados</h1>

      <p className="legal-intro">
        O Cabideia Encanto respeita o seu direito de excluir sua conta e todos os dados associados a ela.
      </p>

      <h2>O que é excluído</h2>
      <ul>
        <li>Seu perfil (nome, e-mail, foto);</li>
        <li>Seus trabalhos e fotos armazenados na nuvem;</li>
        <li>Seus pedidos, clientes e anotações;</li>
        <li>Sua vitrine e propostas;</li>
        <li>Suas inspirações e seleções.</li>
      </ul>

      <h2>Como solicitar</h2>
      <p>
        Envie um e-mail para cabideia.contato@gmail.com com o assunto "Excluir minha conta" e o e-mail que
        você usa para fazer login. Sua conta e todos os dados serão excluídos em até 7 dias úteis. Você
        receberá uma confirmação por e-mail quando a exclusão for concluída.
      </p>
      <p>Você também pode excluir sua conta diretamente pelo app, nas Configurações.</p>

      <h2>Contato</h2>
      <p>cabideia.contato@gmail.com</p>

      <div className="legal-rodape">
        <p className="apoio" style={{ marginTop: 8 }}>© 2026 Cabideia · cabideia.contato@gmail.com</p>
      </div>
    </LegalLayout>
  )
}
