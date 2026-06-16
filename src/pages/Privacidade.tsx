import { LegalLayout } from '../components/LegalLayout'

/**
 * Página pública /privacidade (cabideia.com.br/encanto/privacidade).
 *
 * Política de Privacidade v1.0 (16/06/2026), reproduzida como página estática
 * legível. Sem login e sem barra inferior. Gera a URL exigida pelo Google Play.
 */
export function Privacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade">
      <h1>Política de Privacidade — Cabideia Encanto</h1>
      <p className="legal-meta">
        Versão 1.0 · Última atualização: 16 de junho de 2026 · Em vigor no teste fechado (Google Play)
      </p>

      <p className="legal-intro">
        Esta Política de Privacidade descreve como o aplicativo Cabideia Encanto ("aplicativo", "nós")
        trata os dados pessoais de quem o utiliza ("você", "usuária"), em conformidade com a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018 — LGPD). Ao utilizar o aplicativo, você declara que leu e
        compreendeu esta Política.
      </p>
      <p>
        <b>Controladora dos dados:</b> Josiane Farias Ferreira (marca Cabideia)
      </p>
      <p>
        <b>Contato / Encarregada (DPO):</b> cabideia.contato@gmail.com
      </p>

      <nav className="legal-sumario" aria-label="Sumário">
        <ol>
          <li>O que é o Cabideia Encanto</li>
          <li>Quais dados coletamos</li>
          <li>Como e por que usamos seus dados (finalidades e bases legais)</li>
          <li>Dados de clientes cadastrados por você</li>
          <li>Vitrine pública e compartilhamento por link</li>
          <li>Operadores e terceiros</li>
          <li>Transferência internacional de dados</li>
          <li>Armazenamento e segurança</li>
          <li>Retenção e exclusão</li>
          <li>Seus direitos (LGPD)</li>
          <li>Menores de idade</li>
          <li>Armazenamento no dispositivo (PWA e leitura offline)</li>
          <li>Pagamentos</li>
          <li>Alterações nesta Política</li>
          <li>Contato</li>
          <li>Histórico de versões</li>
        </ol>
      </nav>

      <hr className="legal-sep" />

      <h2>1. O que é o Cabideia Encanto</h2>
      <p>
        O Cabideia Encanto é um aplicativo voltado a profissionais que trabalham por encomenda
        (confeiteiras, crocheteiras, artesãs e afins) para organizar seu portfólio de trabalhos, montar
        uma vitrine para clientes, guardar inspirações, registrar uma tabela de preços, acompanhar pedidos
        de forma simples e gerar propostas. Faz parte da família de produtos Cabideia.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <p>
        <b>Dados de conta:</b> o acesso é feito por "Entrar com o Google". Recebemos do Google as
        informações básicas do seu perfil necessárias à autenticação — e-mail, nome e, quando disponível,
        foto de perfil. Não criamos nem armazenamos senha.
      </p>
      <p>Conteúdo que você cria no aplicativo:</p>
      <ul>
        <li>Fotos que você envia (portfólio "Meus Trabalhos", inspirações e fotos de referência de pedidos);</li>
        <li>Dados de clientes que você cadastra (nome, WhatsApp, observações);</li>
        <li>Pedidos (descrição, datas, status, status de pagamento), propostas, itens da tabela de preços e anotações;</li>
        <li>Informações do seu perfil e da sua vitrine (nome, logo, descrição, contato).</li>
      </ul>
      <p>
        <b>Dados de uso:</b> informações técnicas básicas necessárias ao funcionamento, segurança e
        estabilidade do aplicativo.
      </p>
      <p>
        <b>Dados de assinatura:</b> quando os planos pagos forem ativados, a compra é processada pelo
        Google Play. Não coletamos nem armazenamos dados de cartão; recebemos apenas a confirmação do
        status da assinatura.
      </p>

      <h2>3. Como e por que usamos seus dados (finalidades e bases legais)</h2>
      <ul>
        <li>Criar e autenticar sua conta e manter sua sessão — base legal: execução de contrato.</li>
        <li>Operar as funcionalidades (portfólio, vitrine, pedidos, propostas, tabela de preços, inspirações, anotações) — execução de contrato.</li>
        <li>Exibir a sua vitrine pública e os links que você decide compartilhar — execução de contrato e seu consentimento ao publicar.</li>
        <li>Processar e controlar sua assinatura — execução de contrato.</li>
        <li>Garantir segurança, prevenir fraudes e resolver problemas — legítimo interesse e cumprimento de obrigação legal.</li>
        <li>Comunicar avisos importantes sobre o serviço — legítimo interesse.</li>
      </ul>
      <p>Não vendemos seus dados nem os utilizamos para publicidade de terceiros.</p>

      <h2>4. Dados de clientes cadastrados por você</h2>
      <p>
        O aplicativo permite que você cadastre dados de suas clientes (nome, WhatsApp, observações) para
        organizar seu trabalho. Em relação a esses dados, VOCÊ é a controladora e o Cabideia Encanto atua
        como operador, tratando-os apenas para viabilizar as funcionalidades a seu pedido.
      </p>
      <p>
        Você é responsável por ter base legal para registrar esses dados (por exemplo, o consentimento da
        cliente ou a execução de um pedido), por usá-los de forma lícita e por atender às solicitações das
        suas clientes quanto aos direitos delas. Recomendamos registrar apenas o necessário.
      </p>

      <h2>5. Vitrine pública e compartilhamento por link</h2>
      <p>
        O aplicativo permite publicar uma vitrine acessível por link e compartilhar seleções de fotos e
        propostas com clientes. Somente o conteúdo que você escolhe tornar público (fotos, descrições,
        preços, perfil) fica visível. Você controla, a qualquer momento, o que publicar, ocultar ou
        despublicar. Conteúdo publicado em link pode ser acessado por qualquer pessoa que tenha o endereço.
      </p>

      <h2>6. Operadores e terceiros</h2>
      <p>
        Para operar o aplicativo, contamos com prestadores que tratam dados estritamente para viabilizar o
        serviço, sob obrigações de segurança e confidencialidade:
      </p>
      <ul>
        <li>
          <b>Supabase (Supabase, Inc.):</b> banco de dados, armazenamento das imagens e autenticação. O
          projeto está hospedado em infraestrutura localizada no Brasil (região de São Paulo).
        </li>
        <li>
          <b>Cloudflare (Cloudflare, Inc.):</b> hospedagem e entrega do aplicativo e roteamento de rede,
          por meio de rede global.
        </li>
        <li>
          <b>Google (Google LLC):</b> autenticação via "Entrar com o Google"; e Google Play para
          distribuição do aplicativo e processamento das assinaturas.
        </li>
      </ul>
      <p>
        Não compartilhamos seus dados com terceiros para outros fins, exceto quando exigido por lei ou
        ordem de autoridade competente.
      </p>

      <h2>7. Transferência internacional de dados</h2>
      <p>
        O armazenamento principal dos seus dados (banco de dados e imagens, via Supabase) fica em
        servidores localizados no Brasil. Algumas operações, porém, envolvem empresas com sede ou
        infraestrutura no exterior — em especial o login pelo Google, o processamento de assinaturas pelo
        Google Play e a entrega do aplicativo pela rede global da Cloudflare. Nesses casos, pode haver
        transferência internacional de dados, realizada com as salvaguardas previstas na LGPD.
      </p>

      <h2>8. Armazenamento e segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger seus dados, como controle de acesso por
        conta, regras de autorização por usuária e transmissão criptografada (HTTPS). Nenhum sistema é
        totalmente imune a incidentes, mas trabalhamos continuamente para reduzir riscos.
      </p>

      <h2>9. Retenção e exclusão</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir e enquanto forem necessários às finalidades
        descritas. Você pode solicitar a exclusão da sua conta e dos seus dados a qualquer momento pelo
        contato abaixo. Alguns dados podem ser retidos por prazo adicional quando houver obrigação legal.
      </p>

      <h2>10. Seus direitos (LGPD)</h2>
      <p>
        Você pode, a qualquer momento, solicitar: confirmação da existência de tratamento; acesso aos
        dados; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou
        eliminação; portabilidade; informação sobre compartilhamento; e revogação de consentimento. Para
        exercer seus direitos, use o contato abaixo. Você também pode peticionar à Autoridade Nacional de
        Proteção de Dados (ANPD).
      </p>

      <h2>11. Menores de idade</h2>
      <p>
        O aplicativo é destinado a profissionais maiores de 18 anos e não é direcionado a menores de
        idade. Não coletamos intencionalmente dados de menores.
      </p>

      <h2>12. Armazenamento no dispositivo (PWA e leitura offline)</h2>
      <p>
        Como aplicativo web progressivo (PWA), parte do conteúdo pode ser guardada localmente no seu
        dispositivo para permitir a leitura offline e melhorar o desempenho. Esses dados ficam no seu
        aparelho e podem ser removidos ao limpar os dados do navegador/app.
      </p>

      <h2>13. Pagamentos</h2>
      <p>
        As assinaturas, quando disponíveis, são processadas pelo Google Play, sujeitas aos termos e à
        política de privacidade do Google. Não temos acesso aos dados de pagamento (como número de
        cartão); recebemos apenas a confirmação do status da assinatura.
      </p>

      <h2>14. Alterações nesta Política</h2>
      <p>
        Podemos atualizar esta Política periodicamente. Alterações relevantes serão comunicadas no
        aplicativo, e a data no topo será atualizada. O uso continuado após a atualização implica ciência
        da versão vigente.
      </p>

      <h2>15. Contato</h2>
      <p>
        Dúvidas, solicitações ou reclamações sobre privacidade e dados pessoais: cabideia.contato@gmail.com.
        Respondemos em até 5 dias úteis para dúvidas gerais e em até 15 dias corridos para solicitações
        relacionadas a direitos previstos na LGPD.
      </p>

      <h2>16. Histórico de versões</h2>
      <p>
        v1.0 — junho/2026 — Versão inicial, publicada para o teste fechado no Google Play. Cobre conta via
        "Entrar com o Google", conteúdo da usuária (portfólio, inspirações, pedidos, propostas, tabela de
        preços, anotações), dados de clientes cadastrados pela usuária, vitrine e links públicos,
        operadores (Supabase no Brasil, Cloudflare, Google) e assinaturas via Google Play.
      </p>

      <div className="legal-rodape">
        <p className="apoio">
          Observação: este documento foi elaborado como base e não constitui aconselhamento jurídico.
          Recomenda-se revisão por um(a) advogado(a), especialmente quanto ao tratamento de dados de
          terceiros (clientes) e à transferência internacional.
        </p>
        <p className="apoio" style={{ marginTop: 8 }}>© 2026 Cabideia · cabideia.contato@gmail.com</p>
      </div>
    </LegalLayout>
  )
}
