import type { Metadata } from "next";
import { LegalDoc, P, UL, B, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Política de Privacidade — Shark SmokeHouse",
  description:
    "Como a Shark SmokeHouse coleta, usa, compartilha e protege seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018).",
};

/* Campos entre colchetes a serem preenchidos pelo responsável legal antes de
   considerar o documento definitivo. */
const EMPRESA = {
  nomeFantasia: "Shark SmokeHouse",
  razaoSocial: "Ana Beatriz Kuiper Pereira de Carvalho",
  cnpj: "65.891.927/0001-04",
  endereco: "Rua Comerciante Alfredo Ferreira da Rocha, 742 — Mangabeira, João Pessoa/PB, CEP 58055-540",
  whatsapp: "(83) 99902-0606",
  email: "sharksmokehouse@gmail.com",
  encarregado: "Ana Beatriz Kuiper Pereira de Carvalho — sharksmokehouse@gmail.com",
};

const sections: LegalSection[] = [
  {
    id: "controlador",
    title: "Quem trata os seus dados",
    body: (
      <P>
        O controlador dos dados pessoais tratados nesta loja é{" "}
        <B>{EMPRESA.nomeFantasia}</B> ({EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}), com
        sede em {EMPRESA.endereco}. Esta Política descreve como coletamos, usamos,
        compartilhamos e protegemos seus dados, em conformidade com a Lei Geral de
        Proteção de Dados — LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet.
      </P>
    ),
  },
  {
    id: "dados",
    title: "Dados que tratamos",
    body: (
      <>
        <P>A depender da sua interação com a loja, podemos tratar:</P>
        <UL>
          <li>
            <B>Cadastro e identificação:</B> nome, e-mail, telefone e, quando você opta
            por informá-lo, CPF (necessário para emissão fiscal e para o programa de
            fidelidade).
          </li>
          <li>
            <B>Entrega:</B> endereço, bairro, ponto de referência e dados de contato.
          </li>
          <li>
            <B>Pedidos e transações:</B> itens comprados, valores, forma de pagamento,
            histórico de compras, cupons e pontos de fidelidade. Não armazenamos o número
            completo do cartão — esse dado é tratado pelo provedor de pagamento.
          </li>
          <li>
            <B>Confirmação de maioridade:</B> declaração e, quando aplicável, verificação
            de idade na entrega ou retirada.
          </li>
          <li>
            <B>Dados de navegação:</B> informações técnicas como identificadores de
            sessão, dados de uso e cookies/armazenamento local necessários ao
            funcionamento do site (por exemplo, manter o carrinho e a autenticação).
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para que usamos e com qual base legal",
    body: (
      <>
        <P>Tratamos seus dados para finalidades específicas, com a respectiva base legal da LGPD:</P>
        <UL>
          <li>
            <B>Processar pedidos, pagamentos e entregas</B> e prestar suporte — execução
            de contrato (art. 7º, V).
          </li>
          <li>
            <B>Cumprir obrigações legais e fiscais</B> (emissão de documentos, guarda de
            registros) — obrigação legal/regulatória (art. 7º, II).
          </li>
          <li>
            <B>Verificar a maioridade</B> exigida para a venda de produtos de tabacaria —
            cumprimento de obrigação legal e exercício regular de direitos.
          </li>
          <li>
            <B>Prevenir fraudes</B> e garantir a segurança das operações — legítimo
            interesse (art. 7º, IX).
          </li>
          <li>
            <B>Operar o programa de fidelidade</B> e melhorar a sua experiência — execução
            de contrato e legítimo interesse.
          </li>
          <li>
            <B>Enviar comunicações e ofertas</B>, quando você autorizar — consentimento
            (art. 7º, I), revogável a qualquer momento.
          </li>
        </UL>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies e tecnologias semelhantes",
    body: (
      <P>
        Utilizamos cookies e armazenamento local (localStorage) essenciais ao
        funcionamento da loja — por exemplo, para manter o seu carrinho e a sua sessão
        autenticada — e, quando aplicável, para medir audiência e melhorar o serviço.
        Você pode gerenciar ou bloquear cookies nas configurações do seu navegador, ciente
        de que alguns recursos podem deixar de funcionar corretamente.
      </P>
    ),
  },
  {
    id: "compartilhamento",
    title: "Com quem compartilhamos",
    body: (
      <>
        <P>
          Não vendemos seus dados pessoais. Compartilhamos apenas o necessário, com:
        </P>
        <UL>
          <li>
            <B>Provedores de pagamento</B> (por exemplo, Mercado Pago), para processar e
            validar transações.
          </li>
          <li>
            <B>Provedores de tecnologia e infraestrutura</B> (por exemplo, serviços de
            nuvem e banco de dados do Google Firebase e hospedagem na Vercel), que
            armazenam e processam dados em nosso nome.
          </li>
          <li>
            <B>Equipe e parceiros de entrega</B> (entregadores/transportadoras), com os
            dados indispensáveis para concluir a entrega.
          </li>
          <li>
            <B>Mensageria</B> (por exemplo, WhatsApp), quando você opta por se comunicar ou
            finalizar o pedido por esse canal.
          </li>
          <li>
            <B>Autoridades públicas e contadores</B>, para cumprir obrigações legais,
            fiscais ou ordens judiciais.
          </li>
        </UL>
        <P>
          Os parceiros que tratam dados em nosso nome (operadores) devem adotar medidas de
          segurança e tratar os dados apenas conforme as nossas instruções e a lei.
        </P>
      </>
    ),
  },
  {
    id: "transferencia",
    title: "Transferência internacional",
    body: (
      <P>
        Alguns provedores (como serviços de nuvem e hospedagem) podem armazenar ou
        processar dados em servidores localizados fora do Brasil. Nesses casos, adotamos
        salvaguardas para que a transferência ocorra em conformidade com a LGPD e com
        nível de proteção adequado.
      </P>
    ),
  },
  {
    id: "seguranca",
    title: "Segurança e retenção",
    body: (
      <>
        <P>
          Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados
          contra acessos não autorizados, perda ou alteração. Nenhum sistema é
          absolutamente inviolável, mas trabalhamos continuamente para reduzir riscos.
        </P>
        <P>
          Mantemos os dados pelo tempo necessário às finalidades aqui descritas e ao
          cumprimento de obrigações legais (por exemplo, prazos fiscais). Encerrado esse
          período, os dados são eliminados ou anonimizados.
        </P>
      </>
    ),
  },
  {
    id: "direitos",
    title: "Seus direitos como titular",
    body: (
      <>
        <P>Nos termos da LGPD (art. 18), você pode solicitar a qualquer momento:</P>
        <UL>
          <li>confirmação da existência de tratamento e acesso aos seus dados;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>portabilidade dos dados, observados os segredos comercial e industrial;</li>
          <li>eliminação dos dados tratados com base no seu consentimento;</li>
          <li>informação sobre as entidades com as quais compartilhamos dados;</li>
          <li>revogação do consentimento.</li>
        </UL>
      </>
    ),
  },
  {
    id: "exercer",
    title: "Como exercer seus direitos e falar com o Encarregado",
    body: (
      <>
        <P>
          Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o nosso
          Encarregado pelo Tratamento de Dados (DPO):
        </P>
        <UL>
          <li>Encarregado: {EMPRESA.encarregado}</li>
          <li>E-mail: {EMPRESA.email}</li>
          <li>WhatsApp: {EMPRESA.whatsapp}</li>
        </UL>
        <P>
          Podemos solicitar informações para confirmar a sua identidade antes de atender
          ao pedido, por segurança.
        </P>
      </>
    ),
  },
  {
    id: "menores",
    title: "Menores de idade",
    body: (
      <P>
        A loja é destinada exclusivamente a maiores de 18 anos. Não coletamos
        intencionalmente dados de menores de idade. Se identificarmos cadastro de menor,
        a conta poderá ser encerrada e os dados eliminados. Pais ou responsáveis que
        identifiquem tal situação devem nos contatar.
      </P>
    ),
  },
  {
    id: "alteracoes",
    title: "Atualizações desta Política",
    body: (
      <P>
        Esta Política pode ser atualizada para refletir mudanças legais ou operacionais.
        A versão vigente é sempre a publicada nesta página, com a data de atualização
        indicada no topo. Recomendamos revisá-la periodicamente.
      </P>
    ),
  },
  {
    id: "contato",
    title: "Contato e ANPD",
    body: (
      <>
        <P>
          Em caso de dúvidas, reclamações ou solicitações sobre seus dados, fale conosco
          pelos canais acima. Você também pode peticionar à Autoridade Nacional de
          Proteção de Dados (ANPD).
        </P>
        <UL>
          <li>E-mail: {EMPRESA.email}</li>
          <li>WhatsApp: {EMPRESA.whatsapp}</li>
          <li>Endereço: {EMPRESA.endereco}</li>
        </UL>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Institucional"
      title="Política de Privacidade"
      updatedAt="23 de junho de 2026"
      lead={
        <P>
          A sua privacidade é importante para a <B>Shark SmokeHouse</B>. Esta Política
          explica, de forma clara, quais dados pessoais tratamos, por que, com quem
          compartilhamos e quais são os seus direitos, conforme a Lei Geral de Proteção de
          Dados (LGPD).
        </P>
      }
      highlight={
        <>
          <p>
            <B>Loja para maiores de 18 anos.</B> Tratamos dados de verificação de
            maioridade porque a venda de produtos de tabacaria é proibida a menores.
          </p>
          <p>
            Ao usar a loja, você reconhece ter lido esta Política e a nossa página de
            Termos de Uso.
          </p>
        </>
      }
      sections={sections}
    />
  );
}
