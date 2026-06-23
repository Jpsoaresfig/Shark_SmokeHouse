import type { Metadata } from "next";
import { LegalDoc, P, UL, B, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Termos de Uso — Shark SmokeHouse",
  description:
    "Termos e condições de uso da loja e dos serviços digitais da Shark SmokeHouse. Venda proibida para menores de 18 anos.",
};

/* Dados da empresa. Os campos entre colchetes precisam ser preenchidos pelo
   responsável legal (razão social, CNPJ e e-mail oficial) antes de considerar
   o documento definitivo. */
const EMPRESA = {
  nomeFantasia: "Shark SmokeHouse",
  razaoSocial: "Ana Beatriz Kuiper Pereira de Carvalho",
  cnpj: "65.891.927/0001-04",
  endereco: "Rua Comerciante Alfredo Ferreira da Rocha, 742 — Mangabeira, João Pessoa/PB, CEP 58055-540",
  whatsapp: "(83) 99902-0606",
  email: "sharksmokehouse@gmail.com",
  comarca: "João Pessoa, Estado da Paraíba",
};

const sections: LegalSection[] = [
  {
    id: "aceitacao",
    title: "Aceitação e identificação",
    body: (
      <>
        <P>
          Estes Termos de Uso regem o acesso e a utilização do site, da loja online e
          dos demais serviços digitais oferecidos por <B>{EMPRESA.nomeFantasia}</B>{" "}
          ({EMPRESA.razaoSocial}, inscrita no CNPJ {EMPRESA.cnpj}), com estabelecimento
          em {EMPRESA.endereco} (a seguir, &ldquo;loja&rdquo;, &ldquo;nós&rdquo; ou &ldquo;Shark&rdquo;).
        </P>
        <P>
          Ao navegar, criar uma conta, fazer um pedido ou usar qualquer funcionalidade,
          você declara que leu, entendeu e concorda integralmente com estes Termos e com
          a nossa Política de Privacidade. Caso não concorde, não utilize os serviços.
        </P>
      </>
    ),
  },
  {
    id: "idade",
    title: "Idade mínima e produtos controlados",
    body: (
      <>
        <P>
          A loja comercializa produtos de tabacaria e correlatos cuja venda é{" "}
          <B>proibida para menores de 18 anos</B>, conforme a legislação brasileira
          (em especial a Lei nº 9.294/1996 e o Estatuto da Criança e do Adolescente).
        </P>
        <P>Ao utilizar os serviços e realizar pedidos, você declara e garante que:</P>
        <UL>
          <li>tem 18 anos completos ou mais e plena capacidade civil;</li>
          <li>está adquirindo os produtos para uso próprio e não para revenda a menores;</li>
          <li>
            apresentará documento oficial de identidade com foto, sempre que solicitado,
            no momento da retirada ou da entrega.
          </li>
        </UL>
        <P>
          Reservamo-nos o direito de <B>recusar, cancelar ou não entregar</B> qualquer
          pedido quando houver dúvida razoável sobre a maioridade do comprador ou quando
          a idade não puder ser comprovada na entrega, sem que isso gere obrigação de
          indenizar. Fornecer informação falsa de idade é de exclusiva responsabilidade
          de quem a presta.
        </P>
      </>
    ),
  },
  {
    id: "conta",
    title: "Cadastro, conta e segurança",
    body: (
      <>
        <P>
          Algumas funcionalidades exigem cadastro. Você se compromete a fornecer
          informações verdadeiras, completas e atualizadas, e a mantê-las assim.
        </P>
        <UL>
          <li>As credenciais de acesso são pessoais e intransferíveis.</li>
          <li>
            Você é o responsável por toda atividade realizada na sua conta e deve nos
            avisar imediatamente sobre qualquer uso não autorizado.
          </li>
          <li>
            Podemos suspender ou encerrar contas com indícios de fraude, uso indevido ou
            violação destes Termos.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "produtos",
    title: "Produtos, preços, estoque e informações",
    body: (
      <>
        <P>
          Empenhamo-nos para que descrições, imagens e preços estejam corretos. Ainda
          assim, imagens são meramente ilustrativas e pequenas variações de cor,
          embalagem ou apresentação podem ocorrer.
        </P>
        <UL>
          <li>
            Preços, promoções e disponibilidade podem mudar a qualquer momento e valem
            enquanto exibidos, ressalvados os pedidos já confirmados.
          </li>
          <li>
            A venda está sujeita à disponibilidade de estoque. Se um item ficar
            indisponível após o pedido, entraremos em contato para substituição,
            estorno ou cancelamento.
          </li>
          <li>
            Em caso de <B>erro evidente de preço ou de cadastro</B> (por exemplo, valor
            irrisório por falha de sistema), poderemos cancelar o pedido e restituir
            integralmente os valores pagos, comunicando você previamente.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "pedidos",
    title: "Pedidos: confirmação e recusa",
    body: (
      <>
        <P>
          O envio de um pedido representa uma proposta de compra. O contrato se
          aperfeiçoa com a nossa confirmação (por exemplo, confirmação de pagamento ou
          aceite pela equipe, inclusive via WhatsApp).
        </P>
        <P>
          Podemos recusar ou cancelar pedidos, no todo ou em parte, em situações como
          indício de fraude, falha de pagamento, impossibilidade de comprovar a
          maioridade, erro de preço ou indisponibilidade, com a devida restituição dos
          valores eventualmente pagos.
        </P>
      </>
    ),
  },
  {
    id: "pagamentos",
    title: "Pagamentos",
    body: (
      <>
        <P>
          Os pagamentos podem ser feitos pelos meios disponibilizados na loja, como PIX,
          cartão de crédito ou débito e pagamento na entrega, processados por meio de
          plataformas de pagamento parceiras (por exemplo, o Mercado Pago).
        </P>
        <UL>
          <li>
            Os dados financeiros sensíveis (como número completo do cartão) são tratados
            diretamente pelos provedores de pagamento, sujeitos às políticas deles.
          </li>
          <li>
            O processamento, a aprovação e a análise antifraude da transação dependem do
            provedor e da instituição financeira, não tendo a Shark ingerência sobre
            recusas determinadas por eles.
          </li>
          <li>
            A liberação do pedido pode ficar condicionada à confirmação efetiva do
            pagamento.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "entrega",
    title: "Entrega e retirada",
    body: (
      <>
        <P>
          As entregas são realizadas na área de cobertura informada na loja, por equipe
          própria ou parceira. Também é possível a retirada no estabelecimento.
        </P>
        <UL>
          <li>
            Os prazos informados são <B>estimativas</B> e podem variar conforme bairro,
            trânsito, clima, disponibilidade e fatores alheios ao nosso controle.
          </li>
          <li>
            No recebimento poderá ser exigida a apresentação de documento com foto que
            comprove a maioridade. A entrega não será concluída a menores de idade nem a
            pessoa visivelmente impossibilitada de recebê-la com segurança.
          </li>
          <li>
            É necessário haver pessoa apta a receber no endereço informado. Em caso de
            ausência ou recusa indevida, novas tentativas e custos adicionais podem se
            aplicar.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "trocas",
    title: "Trocas, devoluções e direito de arrependimento",
    body: (
      <>
        <P>
          Respeitamos integralmente o Código de Defesa do Consumidor (CDC).
        </P>
        <UL>
          <li>
            <B>Direito de arrependimento:</B> nas compras feitas fora do estabelecimento
            (online), você pode desistir em até 7 (sete) dias corridos a contar do
            recebimento, com restituição dos valores pagos, nos termos do art. 49 do CDC.
          </li>
          <li>
            <B>Produto com defeito (vício):</B> em caso de vício de qualidade ou
            quantidade, aplicam-se os prazos e direitos dos arts. 18 e 26 do CDC.
          </li>
          <li>
            Por questões sanitárias e de segurança, a devolução por simples
            arrependimento pode não se aplicar a itens consumíveis, lacrados ou de uso
            pessoal cujo lacre tenha sido violado, salvo defeito — sempre observada a lei.
          </li>
          <li>
            Para exercer esses direitos, fale conosco pelos canais de contato indicados
            ao final.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "fidelidade",
    title: "Clube Shark, pontos e cupons",
    body: (
      <>
        <P>
          O programa de fidelidade (Clube Shark), os pontos e os cupons de desconto são
          benefícios promocionais concedidos por liberalidade da loja.
        </P>
        <UL>
          <li>Pontos e cupons não possuem valor monetário e não são conversíveis em dinheiro.</li>
          <li>
            As regras de acúmulo, resgate, validade e expiração podem ser alteradas ou
            encerradas a qualquer momento, mediante comunicação na loja, preservados os
            resgates já efetivados.
          </li>
          <li>
            Benefícios obtidos por fraude, erro ou uso indevido podem ser cancelados.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "uso-aceitavel",
    title: "Uso aceitável",
    body: (
      <>
        <P>Ao usar os serviços, você concorda em não:</P>
        <UL>
          <li>violar leis, direitos de terceiros ou estes Termos;</li>
          <li>fornecer dados falsos, fazer-se passar por outra pessoa ou burlar a verificação de idade;</li>
          <li>tentar acessar áreas restritas, comprometer a segurança ou explorar falhas do sistema;</li>
          <li>utilizar robôs, raspagem (scraping) ou meios automatizados sem autorização;</li>
          <li>publicar conteúdo ilícito, ofensivo, difamatório ou que infrinja direitos.</li>
        </UL>
      </>
    ),
  },
  {
    id: "propriedade",
    title: "Propriedade intelectual e conteúdo do usuário",
    body: (
      <>
        <P>
          A marca, o logotipo, os textos, as imagens, o layout e o software da loja são
          protegidos e pertencem à Shark ou a seus licenciadores. É vedado o uso sem
          autorização prévia e por escrito.
        </P>
        <P>
          Ao enviar avaliações, comentários ou outro conteúdo, você nos concede licença
          gratuita e não exclusiva para exibi-lo nos nossos canais, e declara ser
          responsável pelo que publica. Podemos moderar ou remover conteúdo que viole
          estes Termos ou a lei.
        </P>
      </>
    ),
  },
  {
    id: "terceiros",
    title: "Serviços e links de terceiros",
    body: (
      <P>
        A loja pode integrar serviços de terceiros (pagamento, mapas, redes sociais,
        mensageria) e conter links externos. Não controlamos nem respondemos pelo
        conteúdo, pelas práticas ou pelas políticas desses terceiros, cujos termos
        próprios se aplicam ao uso que você fizer deles.
      </P>
    ),
  },
  {
    id: "responsabilidade",
    title: "Limitação de responsabilidade",
    body: (
      <>
        <P>
          Na máxima extensão permitida pela legislação aplicável, a Shark não responde
          por danos indiretos, lucros cessantes ou prejuízos decorrentes de:
        </P>
        <UL>
          <li>indisponibilidade temporária, falhas técnicas ou interrupções do site ou de serviços de terceiros;</li>
          <li>uso indevido da conta pelo próprio usuário ou por terceiros a quem ele tenha dado acesso;</li>
          <li>informações incorretas fornecidas pelo usuário (como endereço ou idade);</li>
          <li>caso fortuito ou força maior.</li>
        </UL>
        <P>
          <B>Esta limitação não afasta</B> os direitos que o Código de Defesa do
          Consumidor e demais normas de ordem pública asseguram a você. Nada nestes
          Termos exclui responsabilidades que a lei não permita excluir.
        </P>
      </>
    ),
  },
  {
    id: "indenizacao",
    title: "Indenização",
    body: (
      <P>
        Você concorda em manter a Shark indene de reclamações, perdas e despesas
        (incluindo honorários razoáveis) decorrentes do seu descumprimento destes Termos
        ou da lei, ou da violação de direitos de terceiros por ato seu, na medida da sua
        responsabilidade.
      </P>
    ),
  },
  {
    id: "alteracoes",
    title: "Disponibilidade e alterações destes Termos",
    body: (
      <>
        <P>
          Podemos modificar, suspender ou descontinuar funcionalidades a qualquer
          momento, bem como atualizar estes Termos. A versão vigente é sempre a publicada
          nesta página, com a respectiva data de atualização.
        </P>
        <P>
          O uso continuado dos serviços após a publicação de alterações significativas
          representa concordância com a nova versão.
        </P>
      </>
    ),
  },
  {
    id: "foro",
    title: "Lei aplicável e foro",
    body: (
      <P>
        Estes Termos são regidos pela lei brasileira. Fica eleito o foro da comarca de{" "}
        {EMPRESA.comarca}, para dirimir controvérsias, ressalvado o direito do
        consumidor de demandar no foro do seu próprio domicílio, conforme o CDC.
      </P>
    ),
  },
  {
    id: "contato",
    title: "Contato",
    body: (
      <>
        <P>Dúvidas sobre estes Termos? Fale com a gente:</P>
        <UL>
          <li>WhatsApp: {EMPRESA.whatsapp}</li>
          <li>E-mail: {EMPRESA.email}</li>
          <li>Endereço: {EMPRESA.endereco}</li>
        </UL>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Institucional"
      title="Termos de Uso"
      updatedAt="23 de junho de 2026"
      lead={
        <>
          <P>
            Bem-vindo à <B>Shark SmokeHouse</B>. Estes Termos de Uso explicam as regras
            para utilizar a nossa loja e os nossos serviços digitais. Leia com atenção —
            eles formam um contrato entre você e a loja.
          </P>
        </>
      }
      highlight={
        <>
          <p>
            <B>Loja para maiores de 18 anos.</B> Comercializamos produtos de tabacaria,
            cuja venda é proibida a menores de idade. Ao usar a loja, você declara ter 18
            anos ou mais e poderá ter a idade verificada na entrega ou na retirada.
          </p>
          <p>Fumar faz mal à saúde. Consuma com responsabilidade.</p>
        </>
      }
      sections={sections}
    />
  );
}
