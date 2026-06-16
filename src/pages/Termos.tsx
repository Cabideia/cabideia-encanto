import { LegalLayout } from '../components/LegalLayout'

/**
 * Página pública /termos (cabideia.com.br/encanto/termos).
 *
 * Termos de Uso v1.0 (junho/2026), reproduzidos como página estática legível.
 * Sem login e sem barra inferior. Gera a URL exigida pelo Google Play.
 */
export function Termos() {
  return (
    <LegalLayout titulo="Termos de Uso">
      <h1>Termos de Uso — Cabideia Encanto</h1>
      <p className="legal-meta">
        Versão 1.0 · Última atualização: junho de 2026 · Em vigor no teste fechado (Google Play)
      </p>

      <p className="legal-intro">
        Estes Termos de Uso regulam o acesso e a utilização do aplicativo Cabideia Encanto. Ao instalar,
        acessar ou utilizar o aplicativo, você declara que leu, compreendeu e concorda integralmente com
        estes Termos e com a Política de Privacidade. Se você não concordar com algum dos pontos abaixo,
        por favor, não utilize o aplicativo.
      </p>

      <nav className="legal-sumario" aria-label="Sumário">
        <ol>
          <li>O que é o Cabideia Encanto</li>
          <li>Aceitação dos termos</li>
          <li>Conta e maioridade</li>
          <li>Planos e limites de uso</li>
          <li>Responsabilidades da usuária</li>
          <li>Conteúdo das fotos e dados de clientes</li>
          <li>Conta, armazenamento e backup na nuvem</li>
          <li>Dependência de terceiros</li>
          <li>Limitação de responsabilidade</li>
          <li>Propriedade intelectual</li>
          <li>Vitrine pública e compartilhamento por link</li>
          <li>Cancelamento e exclusão</li>
          <li>Alterações nos termos</li>
          <li>Lei aplicável e foro</li>
          <li>Contato</li>
        </ol>
      </nav>

      <hr className="legal-sep" />

      <h2>1. O que é o Cabideia Encanto</h2>
      <p>
        O Cabideia Encanto é um aplicativo para profissionais que trabalham por encomenda (confeiteiras,
        crocheteiras, artesãs e afins), que permite:
      </p>
      <ul>
        <li>Cadastrar e organizar um portfólio de trabalhos ("Meus Trabalhos");</li>
        <li>Montar uma vitrine para clientes, acessível por link;</li>
        <li>Guardar inspirações e referências;</li>
        <li>Registrar uma tabela de preços;</li>
        <li>Acompanhar pedidos de forma simples (descrição, datas, status, status de pagamento);</li>
        <li>Gerar propostas para clientes;</li>
        <li>Salvar e sincronizar os dados na nuvem, com leitura offline.</li>
      </ul>
      <p>
        <b>Versão de teste:</b> o Cabideia Encanto está em fase de teste fechado. Isso significa que o
        aplicativo está em desenvolvimento ativo, pode conter erros, e funcionalidades podem ser alteradas,
        adicionadas ou removidas.
      </p>

      <h2>2. Aceitação dos termos</h2>
      <p>
        O uso do aplicativo implica a aceitação integral destes Termos e da Política de Privacidade. Em
        caso de alterações relevantes, novo aceite poderá ser solicitado dentro do aplicativo.
      </p>

      <h2>3. Conta e maioridade</h2>
      <p>
        O acesso é feito por "Entrar com o Google": você utiliza sua conta Google para autenticar-se, sem
        criação de senha específica. Seus dados são salvos e sincronizados na nuvem, vinculados a essa
        conta.
      </p>
      <p>
        O Cabideia Encanto é destinado a usuárias com 18 anos ou mais. Ao utilizar o aplicativo, você
        declara expressamente ter idade igual ou superior a 18 anos. O aplicativo não se destina a menores
        de idade e não prevê o cadastro de perfis de menores.
      </p>

      <h2>4. Planos e limites de uso</h2>
      <p>
        Durante o teste fechado, o aplicativo é oferecido sem cobrança. Quando os planos pagos forem
        ativados, o modelo previsto é:
      </p>
      <ul>
        <li>
          <b>Plano Grátis:</b> uso gratuito com um limite de armazenamento de imagens (atualmente 150
          imagens, somando portfólio, inspirações e referências).
        </li>
        <li>
          <b>Plano pago (Vitrine):</b> recursos ampliados, com período de avaliação gratuito e cobrança
          por assinatura.
        </li>
      </ul>
      <p>
        As assinaturas serão processadas pelo Google Play. Os valores, a periodicidade e as condições serão
        divulgados dentro do aplicativo com antecedência mínima de 30 dias antes do início da cobrança.
        Você poderá continuar no plano gratuito, assinar um plano pago, ou cancelar a assinatura a qualquer
        momento, sem multa, mantendo o acesso pago até o fim do período já pago, conforme as regras do
        Google Play.
      </p>
      <p>
        Eventuais ofertas especiais de lançamento (por exemplo, condições para as primeiras usuárias) serão
        informadas no aplicativo, com suas regras específicas.
      </p>

      <h2>5. Responsabilidades da usuária</h2>
      <p>Ao utilizar o aplicativo, você concorda em:</p>
      <ul>
        <li>Utilizá-lo apenas para fins profissionais e lícitos;</li>
        <li>Ser responsável pelo conteúdo que insere (fotos, descrições, dados de perfil e de clientes);</li>
        <li>Ter autorização ou base legal para cadastrar dados de suas clientes, e tratá-los de forma lícita;</li>
        <li>Não publicar conteúdo que viole direitos de terceiros (incluindo direitos autorais e de imagem);</li>
        <li>Manter o acesso à sua conta Google seguro, pois o login do aplicativo depende dele;</li>
        <li>Não tentar reverter, modificar, copiar ou explorar comercialmente o código do aplicativo sem autorização.</li>
      </ul>

      <h2>6. Conteúdo das fotos e dados de clientes</h2>
      <p>
        Você é integralmente responsável pelo conteúdo das imagens e dos dados que insere. Ao publicar
        fotos na vitrine ou compartilhá-las por link, garanta que tem direito de usá-las e que não expõem
        informações sensíveis de terceiros sem autorização.
      </p>
      <p>
        Ao cadastrar dados de clientes (nome, WhatsApp, observações), você declara ter base legal para isso
        e assume a responsabilidade por esses dados perante as titulares, conforme detalhado na Política de
        Privacidade.
      </p>

      <h2>7. Conta, armazenamento e backup na nuvem</h2>
      <p>
        Seus dados — perfil, trabalhos, inspirações, pedidos, propostas, tabela de preços, anotações e
        clientes — são salvos e sincronizados na nuvem, vinculados à sua conta, permitindo acesso a partir
        de diferentes dispositivos. O aplicativo também permite leitura offline dos últimos dados
        visualizados; a criação e a edição exigem conexão com a internet.
      </p>
      <p>
        Atenção: a exclusão da sua conta remove os dados da nuvem de forma permanente. Recursos adicionais
        de exportação/backup poderão ser oferecidos futuramente.
      </p>

      <h2>8. Dependência de terceiros</h2>
      <p>
        Algumas funcionalidades dependem de serviços operados por terceiros, descritos na Política de
        Privacidade, em especial:
      </p>
      <ul>
        <li>Supabase, Inc. — banco de dados, armazenamento de imagens e autenticação (infraestrutura localizada no Brasil);</li>
        <li>Cloudflare, Inc. — hospedagem, entrega do aplicativo e roteamento de rede;</li>
        <li>Google LLC — autenticação ("Entrar com o Google"), distribuição via Google Play e processamento das assinaturas.</li>
      </ul>
      <p>
        Mudanças nas políticas, preços, condições ou disponibilidade desses serviços podem impactar
        funcionalidades do aplicativo. Nessas hipóteses, podemos modificar, suspender ou substituir o
        serviço afetado, ajustar limites ou descontinuar funcionalidades inviabilizadas, com comunicação
        prévia razoável dentro do aplicativo.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        O aplicativo é fornecido "como está", em fase de teste. Não garantimos disponibilidade
        ininterrupta, ausência de erros, ou compatibilidade com todos os dispositivos. O Cabideia Encanto
        não será responsável por: perda de dados decorrente de ação ou omissão da usuária; indisponibilidade
        de serviços de terceiros (Supabase, Cloudflare, Google); nem por uso indevido do aplicativo. Esta
        limitação se aplica na máxima extensão permitida pela legislação brasileira, em especial pelo
        Código de Defesa do Consumidor (Lei nº 8.078/1990).
      </p>

      <h2>10. Propriedade intelectual</h2>
      <p>
        O nome Cabideia, o nome Cabideia Encanto, o logotipo, o design e o código-fonte do aplicativo são
        de propriedade da desenvolvedora. É vedada a reprodução, distribuição, modificação ou uso comercial
        sem autorização prévia e expressa.
      </p>
      <p>
        O conteúdo que você insere (fotos, descrições, dados) é de sua propriedade. O Cabideia Encanto não
        reivindica direitos sobre esse conteúdo e não o utiliza além do necessário para executar as
        funcionalidades do aplicativo.
      </p>

      <h2>11. Vitrine pública e compartilhamento por link</h2>
      <p>
        O aplicativo permite publicar uma vitrine e compartilhar seleções de fotos e propostas por link.
        Somente o conteúdo que você torna público fica visível, e você controla isso a qualquer momento.
        Conteúdo disponibilizado por link pode ser acessado por qualquer pessoa que tenha o endereço;
        avalie o que deseja compartilhar.
      </p>

      <h2>12. Cancelamento e exclusão</h2>
      <p>
        Você pode encerrar o uso a qualquer momento, sem custo. O aplicativo permite sair da conta (encerra
        a sessão, mantendo os dados na nuvem) e excluir a conta e os dados (apaga de forma permanente seus
        dados da nuvem). O cancelamento de assinaturas pagas é feito pelo Google Play.
      </p>

      <h2>13. Alterações nos termos</h2>
      <p>
        Podemos atualizar estes Termos conforme o aplicativo evolui. Alterações relevantes serão
        comunicadas dentro do aplicativo. O uso continuado após a atualização implica aceitação dos novos
        Termos. Caso não concorde, você poderá encerrar o uso e excluir seus dados a qualquer momento,
        conforme a seção 12.
      </p>

      <h2>14. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira, em especial pela Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018), pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pelo Marco
        Civil da Internet (Lei nº 12.965/2014). Eventuais controvérsias poderão ser submetidas ao foro do
        domicílio da usuária, conforme o Art. 101, I do Código de Defesa do Consumidor.
      </p>

      <h2>15. Contato</h2>
      <p>
        Para dúvidas, sugestões, reclamações ou solicitações relacionadas a estes Termos:
        cabideia.contato@gmail.com. Respondemos em até 5 dias úteis para dúvidas gerais e em até 15 dias
        corridos para solicitações relacionadas a direitos previstos na LGPD.
      </p>

      <div className="legal-rodape">
        <p className="apoio">
          <b>Histórico de versões:</b> v1.0 — junho/2026 — Versão inicial, publicada para o teste fechado
          no Google Play. Estrutura espelhada nos Termos do Cabideia, adaptada ao Encanto: login via
          "Entrar com o Google", planos via Google Play, dados de clientes cadastrados pela usuária,
          vitrine e links públicos, operadores Supabase/Cloudflare/Google.
        </p>
        <p className="apoio" style={{ marginTop: 8 }}>
          © 2026 Cabideia · Todos os direitos reservados · cabideia.contato@gmail.com
        </p>
      </div>
    </LegalLayout>
  )
}
