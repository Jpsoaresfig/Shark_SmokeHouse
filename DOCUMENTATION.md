# 🦈 Shark Smokehouse — Documentação Completa do Sistema

> Documentação técnica e funcional do sistema **Shark Smokehouse** — e-commerce + lounge
> de uma tabacaria em João Pessoa/PB. Este documento descreve todas as funcionalidades,
> a arquitetura, os fluxos de negócio, os dados e a operação do sistema.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Como rodar o projeto](#3-como-rodar-o-projeto)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Papéis de usuário](#5-papéis-de-usuário)
6. [Funcionalidades do cliente (loja)](#6-funcionalidades-do-cliente-loja)
7. [Painel administrativo](#7-painel-administrativo)
8. [Programa de fidelidade (Clube Shark)](#8-programa-de-fidelidade-clube-shark)
9. [Pagamentos](#9-pagamentos)
10. [Estoque e variações](#10-estoque-e-variações)
11. [Lounge (agendamento)](#11-lounge-agendamento)
12. [Automações de servidor (API, webhook e cron)](#12-automações-de-servidor-api-webhook-e-cron)
13. [Banco de dados (Firestore)](#13-banco-de-dados-firestore)
14. [Regras de segurança](#14-regras-de-segurança)
15. [Deploy e operação](#15-deploy-e-operação)
16. [Testes automatizados](#16-testes-automatizados)
17. [Fluxos de negócio detalhados](#17-fluxos-de-negócio-detalhados)

---

## 1. Visão geral

O Shark Smokehouse é um sistema completo de **e-commerce + lounge** para uma tabacaria.
Ele cobre toda a operação comercial em uma única aplicação:

- **Para o cliente:** catálogo de produtos, carrinho, checkout com várias formas de
  pagamento, rastreio de pedidos em tempo real, agendamento do lounge, programa de
  fidelidade (pontos, níveis, resgates e indicação), notificações e suporte.
- **Para a loja:** um painel administrativo com gestão de produtos, pedidos, PDV
  (ponto de venda de balcão), estoque, contas a receber, financeiro, cupons, agenda do
  lounge, entregas, motoboys, vendedores, avaliações, eventos, avisos, configurações do
  site e relatórios.
- **Para o motoboy:** uma área própria para visualizar e "pegar" entregas disponíveis.

Construído com **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**,
**Firebase** (Firestore, Auth, Storage) e **Mercado Pago** (PIX online).

Dados da empresa utilizados no sistema:

| Dado | Valor |
|---|---|
| WhatsApp | 55 83 99902-0606 |
| Endereço | Rua Comerciante Alfredo Ferreira da Rocha, 742 — Mangabeira, João Pessoa/PB |
| CNPJ | 65.891.927/0001-04 |
| Fuso horário da loja | America/Fortaleza |

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix UI, framer-motion, lucide-react |
| Estado | Zustand (com `persist` no carrinho) |
| Backend | Firebase — Firestore (dados), Auth (login), Storage (imagens de eventos) |
| Imagens | Cloudinary (upload de produtos/eventos/popup) + loader custom do `next/image` |
| Pagamento online | Mercado Pago Checkout Pro (PIX) via webhook |
| E-mail | Resend (template de redefinição de senha) |
| Importação de produtos | `xlsx` (CSV e Excel .xlsx/.xls) |
| Testes | Vitest (lógica pura) |

---

## 3. Como rodar o projeto

### Instalar dependências

```bash
npm install
```

### Variáveis de ambiente

Crie um `.env.local` na raiz com todas as chaves abaixo:

```env
# Firebase (Project Settings → Your apps → Web)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK (somente servidor — webhooks, cron, redefinição de senha)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Cloudinary (upload de imagens — preset deve ser "unsigned")
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# URL pública do app (usada nos links de redefinição de senha)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Mercado Pago (opcional — habilitar PIX online)
NEXT_PUBLIC_MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=

# Segredo dos cron jobs (protege as rotas de cron)
CRON_SECRET=

# Resend (e-mail de redefinição de senha)
RESEND_API_KEY=
```

> **Atenção:** em produção, `NEXT_PUBLIC_APP_URL` precisa apontar para a URL real, senão
> os links de redefinição de senha apontam para `localhost`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Roda os testes (Vitest) uma vez |
| `npm run test:watch` | Testes em modo watch |

---

## 4. Estrutura de pastas

```
src/
├─ app/                     # rotas (App Router)
│  ├─ admin/                # painel administrativo (20 sub-rotas)
│  ├─ api/                  # rotas de servidor (auth, cron, pagamentos, webhooks)
│  ├─ about, contact, events, privacy, terms
│  ├─ account/              # perfil, pontos, resgates
│  ├─ cart/, checkout/      # carrinho e finalização de compra
│  ├─ catalog/              # catálogo público
│  ├─ clube/                # programa de fidelidade
│  ├─ login, register, forgot-password, reset-password
│  ├─ lounge/               # agendamento do lounge
│  ├─ motoboy/              # área do motoboy
│  └─ orders/               # meus pedidos / rastreio
├─ components/              # UI, shop, landing, admin, layout, checkout, etc.
├─ stores/                  # Zustand: cartStore, authStore, siteSettingsStore, toastStore
├─ hooks/                   # useAuth, useBarcodeScanner, useNewOrderAlerts
├─ providers/               # AuthProvider
├─ lib/
│  ├─ firebase/             # acesso a dados por coleção (orders, products, sales, …)
│  ├─ payments/             # gateway manual + Mercado Pago
│  ├─ loyalty/              # motor de níveis e resgate do Clube Shark
│  └─ (booking, businessHours, coupons, cpf, stock, csv, age, …)
├─ proxy.ts                 # proteção de rotas
└─ types/                   # tipos compartilhados (Product, Order, CartItem, …)
```

---

## 5. Papéis de usuário

Cada usuário tem uma `role` gravada no documento `users/{uid}`:

| Papel | `role` | Acesso |
|---|---|---|
| **Admin (Master)** | `admin` | Todo o painel, incluindo a área interna oculta. `admin@shark.com` é o admin principal. |
| **Vendedor** | `seller` | Área do vendedor + PDV (vendas do balcão), com comissão configurável. |
| **Motoboy** | `motoboy` | Área do motoboy (pool de entregas). |
| **Cliente** | `customer` | Loja, conta, pedidos, clube, lounge. |

A área `/admin` exige login; vendedores são redirecionados para `/admin/seller` e são
bloqueados da área interna (`/admin/internal`) mesmo digitando a URL. O admin principal
é identificado pelo e-mail `admin@shark.com` (o login com esse e-mail força a role `admin`).

---

## 6. Funcionalidades do cliente (loja)

### 6.1 Home (landing page)

A home é montada a partir das configurações do CMS (`settings/site`) e dos dados do
Firestore, com seções que podem ser **ligadas/desligadas pelo admin**:

- **Hero / Banner principal** (`hero`)
- **Produtos em Destaque** (`featuredProducts`) — produtos marcados como `featured`
- **Nossos Produtos** (`StoreProducts`) — vitrine com destaque de produtos (`storeHighlight`)
- **Lounge / Agendamento** (`lounge`) — chamada para agendar o lounge (desativar remove
  a seção de todo o site, incluindo menu, rodapé e página de agendamento)
- **Próximos Eventos** (`events`)
- **Horário de funcionamento** — banner indicando "Aberto agora" / "Fechado agora"

Elementos globais:

- **AgeGate** — tela de confirmação de **maioridade (18+)** antes de acessar a loja.
- **Popup promocional** — popup configurável pelo admin (título, texto, imagem, botão e
  destino), exibido quando ativo.
- **Anúncios / promoções** — avisos do admin aparecem no "sininho" de notificações.

### 6.2 Catálogo

- Lista de produtos ativos (produtos `internal` **nunca** aparecem para o cliente).
- **Filtros por categoria** (dinâmica, gerenciada pelo admin) e **busca por texto**.
- **Modal de produto**: galeria de imagens, descrição, escolha de **cor/variação**
  (sabor/aroma/cor com foto própria e estoque próprio), badge de desconto
  (`compareAtPrice`), nota informativa de quantos pontos o cliente ganha na compra.
- Cada variação escolhida vira uma **linha separada no carrinho**.

### 6.3 Carrinho

- Drawer lateral e página `/cart` (persistido em `localStorage` via Zustand).
- Ajuste de quantidade, remoção, nota por item.
- **Barra de frete grátis**: quando ativado pelo admin, mostra o progresso até o
  subtotal mínimo (padrão R$ 150) e zera o frete ao atingi-lo.

### 6.4 Checkout (`/checkout`)

Fluxo completo de finalização de compra:

1. **Dados do cliente** — nome, telefone, CPF (obrigatório para ganhar pontos), endereço
   de entrega (CEP via ViaCEP, bairro para cálculo do frete).
2. **Frete por bairro** — a taxa é definida pela tabela `deliveryAreas` (gestionada no admin).
3. **Cupom de desconto** — validação em tempo real (ativo, não expirado, valor mínimo,
   limite por CPF, restrição por categoria).
4. **Formas de pagamento** (seis):
   - **PIX manual** (`pix_manual`) — exibe chave PIX e/ou **QR Code "copia e cola"**;
     o cliente envia o comprovante via WhatsApp e o admin dá a baixa.
   - **Mercado Pago (PIX online)** (`mercadopago`) — cobrança automática com QR Code
     gerado na API do Mercado Pago e confirmação via webhook/polling.
   - **Pagamento na entrega** (`on_delivery`) — cobrança pelo motoboy.
   - **Cartão de crédito na maquininha** (`credit`) — com **taxa configurável**
     (acréscimo/desconto, Lei 13.455/2017) e **parcelamento** (tabela editável de taxas).
   - **Cartão de débito na maquininha** (`debit`) — com diferença configurável.
   - **WhatsApp** (`whatsapp`) — tratativa direta; o pedido fica `awaitingConfirmation`
     até o cliente confirmar, só então o estoque é baixado.
   - **Resgate com pontos** (`loyalty`) — pagar usando saldo do Clube Shark.
5. **Validação de estoque** — bloqueia a venda acima do disponível (somando todas as
   variações/cores do mesmo produto).
6. **Horário de funcionamento** — se a loja estiver **fechada** no momento da compra,
   o pedido entra numa **fila de espera** (`reserved`) e é liberado automaticamente
   quando a loja abrir (cron `orders-queue`).
7. **Tela de sucesso** com resumo por forma de pagamento.

### 6.5 Meus pedidos e rastreio (`/orders`)

- Lista de pedidos do cliente com **atualização em tempo real** (Firestore onSnapshot).
- **Rastreio do pedido**: linha do tempo com os status
  `reserved → received → analyzing → approved → preparing → out_for_delivery → delivered`
  (ou `cancelled`).
- Botão para o cliente **confirmar pedidos WhatsApp** (baixa o estoque pendente).
- Possibilidade de **avaliar o pedido** (nota de 1 a 5 + comentário), visível no admin.
- **Notificações** criadas a cada mudança de status.

### 6.6 Programa de fidelidade — Clube Shark (`/clube` e `/account`)

Ver seção [8 — Programa de fidelidade](#8-programa-de-fidelidade-clube-shark).

### 6.7 Conta do cliente (`/account`)

- Perfil editável (nome, telefone, CPF, foto).
- **Endereços** de entrega salvos (com endereço padrão).
- Saldo de **pontos** e extrato de transações de fidelidade.
- Nível atual do Clube Shark e progresso para o próximo nível.

### 6.8 Login, cadastro e recuperação de senha

- **Login** com e-mail/senha e **Login com Google**.
- **Cadastro** com aceite de **maioridade (18+)** (termos e política de privacidade),
  campo de **código de indicação** e data de nascimento. Menores de 18 têm a conta
  **bloqueada até o aniversário de 18 anos** (`blockedUntil`, com auto-liberação).
- **Esqueci minha senha** — envia e-mail customizado (Resend) com link para a tela
  própria de redefinição `/reset-password`.

### 6.9 Motoboy (`/motoboy`)

- **Pool de entregas disponíveis** (pedidos sem motoboy atribuído), em tempo real.
- O motoboy **"pega" a entrega** via transação atômica (anti-corrida: dois motoboys não
  pegam o mesmo pedido).
- Visualiza os pedidos que está levando e atualiza o status (ex.: entregue).

### 6.10 Outras páginas

- **Eventos** (`/events`) — agenda de eventos da loja (gerenciados pelo admin).
- **Sobre** (`/about`), **Contato** (`/contact` — WhatsApp), **Privacidade** (`/privacy`)
  e **Termos** (`/terms`).
- **Reporte de problemas** — botão flutuante que captura contexto técnico automaticamente
  (URL, viewport, tela, idioma, plataforma, fuso, referrer, online/offline) e envia para
  a central de reportes do admin.

### 6.11 Notificações in-app

- **Centro de notificações** (sininho) com abas **Pedidos** e **Promoções**.
- Notificações pessoais por mudança de status de pedido; avisos globais publicados pelo
  admin (lidos são marcados localmente por usuário, sem gravar doc por usuário).

---

## 7. Painel administrativo

> Acesso: `/admin`. Requer login. Admin = role `admin`; vendedor = `seller` (área própria).

### 7.1 Dashboard (`/admin`)

Visão geral da operação em tempo real:

- **Métricas** de pedidos, vendas PDV, usuários, produtos e estoque (baixo/alerta).
- **Alertas de pedido novo** — som, notificação do sistema e toast ao receber pedido.
- **Faturamento por mês** com gráfico de receita e **gráfico de rosca configurável**.
- **Status da loja** (aberta/fechada) e fila de pedidos reservados fora do horário.
- Vendas internas (produtos ocultos) ficam de fora das métricas do dashboard.

### 7.2 Pedidos (`/admin/orders`)

Gestão dos pedidos da loja online:

- Lista em tempo real com filtros por status e forma de pagamento.
- **Mudança de status** (funil sem retrocesso): baixa o estoque no cancelamento
  (com guard anti-duplicidade), cria notificação para o cliente a cada mudança.
- **Baixa financeira manual**: registrar PIX pago, confirmar pagamento, etc.
  (ao marcar `paid`, o sistema dispara a qualificação da indicação relacionada).
- **Atribuir motoboy** para a entrega.
- **Creditar pontos** da compra quando entregue (com guard de "uma única vez").
- Histórico completo de status (`statusHistory`) e de pagamento (`payment.history`).

### 7.3 Vendas / PDV (`/admin/sales`)

Ponto de venda de balcão (componente `SalePdv` compartilhado com a área interna):

- **Busca rápida de produto** com **leitor de código de barras** (SKU via keyboard HID).
- **Mini calculadora** e ajuste de quantidades.
- **Cadastro rápido de cliente** no balcão (`createWalkInCustomer`).
- **Formas de pagamento**: PIX, crédito, débito, dinheiro (e cartão legado).
- **Fiado / parcial / pendente**: registrar recebimento parcial, quitar saldo, vencimento.
- **Desconto manual** (com motivo obrigatório) e **cupom de desconto**.
- **Entrega posterior** (produto não retirado na hora) com marcação de entrega.
- **Pontos do Clube Shark**: credita pontos ao cliente vinculado (creditados ao quitar,
  sem duplicação; revertidos no cancelamento).
- **Comissão de vendedor**: % calculada sobre as vendas do vendedor.
- **Cancelamento** com motivo: estorna estoque (guard `stockReversed`) e reverte pontos
  (guard `pointsReversed`).
- **Trilha de auditoria** da venda (`audit`): criação, recebimentos, mudanças de status,
  cancelamento, estorno de estoque e reversão de pontos.
- **Exportação CSV** das vendas e do ranking de produtos vendidos.

### 7.4 Estoque (`/admin/inventory`)

- Lista de produtos com quantidade e **alerta de estoque baixo** (`stock <= minStock`).
- **Movimentações tipadas**: Entrada (`in`), Saída (`out`), Ajuste (`adjustment`),
  Perda (`loss`) — cada uma registra `productId`, `productName`, tipo, quantidade,
  motivo (obrigatório) e usuário.
- Histórico de movimentações recentes.
- Distinção entre produtos normais e internos.

### 7.5 Produtos (`/admin/products`)

CRUD completo do catálogo:

- Campos: nome, slug, descrição (curta/longa), preço, preço comparativo, categoria,
  tags, imagens (upload **Cloudinary**), estoque, estoque mínimo, SKU, marca, tamanho,
  custo de aquisição, imposto, destaque, vitrine, ativo, interno.
- **Variações / grade**: mesmo preço, atributo (sabor/aroma/cor), **SKU próprio**,
  **estoque próprio** e **galeria própria** por variação.
- **Cores** (legado, sem estoque próprio) para produtos antigos.
- **Pontos de fidelidade**: toggle "Gera pontos na compra", **custo de resgate**
  calculado automaticamente (valor × 200) com trava de margem, override manual e
  desativação de resgate por produto.
- **Pontos em Dobro** por produto ou por categoria inteira.
- **Importação em massa por planilha** (CSV/Excel) — agrupa linhas com mesmo
  nome+marca+tamanho e cores/aromas diferentes em variações de um só produto.
- **Categorias**: criar, renomear, excluir (com aviso de produtos em uso), ativar
  "Pontos em Dobro".

### 7.6 Lounge (`/admin/lounge`)

Agenda do lounge:

- **Calendário mensal** com as reservas (`pending`/`approved`/`cancelled`).
- Criar, editar e excluir reservas; **aprovar/reprovar/cancelar**.
- **Configuração dos horários disponíveis** para reserva (lista editável de slots).
- Bloqueio de conflito de horário via trava atômica na coleção `lounge_slots`.

### 7.7 Usuários (`/admin/users`)

- Lista de clientes, vendedores e motoboys.
- **Criar funcionários** (vendedor/motoboy) via API.
- **Editar perfil**, **mudar papel** (`role`), **definir comissão** de vendedor.
- **Ajuste manual de pontos** do Clube Shark (com razão: resgate no balcão, estorno,
  cortesia, correção de saldo) — assinado, com auditoria.
- Excluir usuário. Nível de fidelidade exibido.

### 7.8 Financeiro (`/admin/financial`)

- Indicadores de **receita, lucro e faturamento** por mês.
- **Lucro** calculado a partir do **custo de aquisição congelado** em cada venda
  (produto + variação) e da taxa de imposto.
- Gráficos de receita (barras) e **gráfico de rosca configurável**.
- Contas a receber (fiado/parcial) e vendas internas excluídas dos indicadores gerais.

### 7.9 Pagamentos — configuração (`/admin/payments`)

Configuração da cobrança no checkout:

- **Chave PIX** (obrigatória) + titular + **PIX copia e cola (BR Code)** com
  pré-visualização do QR Code.
- **Diferença no crédito/débito (%)** — acréscimo, desconto ou sem diferença
  (Lei 13.455/2017).
- **Parcelamento no crédito** — tabela editável de taxas por parcela (2x, 3x, …;
  1x = à vista, sem taxa). Define quais parcelas aparecem no checkout.
- As mudanças sincronizam o store de configurações para o checkout usar na hora.

### 7.10 Contas a Receber (`/admin/receivables`)

- Cobranças em aberto (vendas `pending`/`partial`) com vencimento.
- **Receber** valor parcial (com forma de pagamento e responsável) ou **quitar** de uma vez.
- **Cancelar** venda em aberto (estorna estoque e reverte pontos).

### 7.11 Cupons (`/admin/coupons`)

- CRUD de cupons de desconto.
- Tipos: **percentual** (%) ou **fixo** (R$).
- Regras: valor mínimo do pedido, data de expiração, **limite de usos por CPF**,
  **restrição por categorias** (desconto só nos itens elegíveis).
- Registro de uso (`couponRedemptions`) para auditoria e limite.

### 7.12 Reportes (`/admin/reports`)

- Central de atendimento/reclamações vindas do site.
- Filtros por status (abertos/resolvidos) e por categoria (bug, pagamento, visual,
  sugestão, outro), com contagem.
- Detalhes técnicos capturados automaticamente (URL, viewport, tela, plataforma,
  idioma, fuso, referrer, user-agent, online) e botão "copiar detalhes".
- Resolver/reabrir e excluir.

### 7.13 Site & Vitrine (`/admin/sections`)

Configurações gerais do site:

- **Visibilidade das seções** da home (hero, produtos em destaque, lounge, eventos).
- **Frete grátis**: ativa/desativa + subtotal mínimo (padrão R$ 150).
- **Horário de funcionamento**: dias da semana com horários, mensagem de "fechado"
  (indicador "Aberto agora"/"Fechado agora").
- **Popup promocional**: título, texto, imagem, link (para catálogo ou produto) e
  rótulo do botão.

### 7.14 Avisos & Promoções (`/admin/announcements`)

- Publica avisos/promoções globais que aparecem nas notificações dos clientes.
- Campos: título, corpo, link opcional e ativo/oculto (rascunho).

### 7.15 Frete por bairro (`/admin/delivery`)

- Tabela de **bairros e taxas de entrega** (seed com ~70 bairros de João Pessoa e
  região metropolitana).
- Criar bairro (nome + frete + região), **edição inline da taxa**, excluir, busca
  normalizada sem acentos, agrupado por região.

### 7.16 Eventos (`/admin/events`)

- CRUD de eventos exibidos na home e em `/events`.
- Imagem (Cloudinary), título, descrição, data, visível/oculto.
- Separa **próximos** de **eventos passados**.

### 7.17 Avaliações (`/admin/reviews`)

- Leitura das avaliações dos clientes (estrelas 1–5, média e total). Sem mutação.

### 7.18 Área do Vendedor (`/admin/seller`)

- Dashboard exclusivo do vendedor com suas vendas e **comissão** (`commissionRate`).
- Acessa o PDV para registrar vendas.

### 7.19 Produtos Internos (`/admin/internal`)

Área **restrita ao admin** para itens de **uso interno** (produtos `internal`) que
**não aparecem na loja** mas continuam no estoque e vendem no PDV. 4 abas:

1. **Produtos** — CRUD dos produtos internos (com custo e preço de venda).
2. **Estoque** — indicadores (custo, valor de venda, quantidade), status crítico/OK e
   movimentações (só internos).
3. **Venda** — PDV configurado só para o catálogo interno (`SalePdv` compartilhado).
4. **A Receber** — contas a receber apenas de vendas internas (receber/quitar/cancelar).

---

## 8. Programa de fidelidade (Clube Shark)

### 8.1 Níveis

O nível é definido pelo **saldo de pontos** (fonte única de verdade em
`src/lib/loyalty/levels.ts`):

| Nível | Saldo | Pontos por R$ | Bônus de aniversário |
|---|---|---|---|
| **Baby Shark** | 0 – 2.999 | 10 | — |
| **Hunter Shark** | 3.000 – 5.999 | 11 | — |
| **Predatory Shark** | 6.000 – 9.999 | 13 | +200 |
| **Megalodon** | 10.000+ | 15 | +500 |

- **Bônus de boas-vindas:** 50 pontos no cadastro (exceto admins).
- **Validade dos pontos:** 180 dias (expiração planejada em lotes, sem saldo negativo).
- **Gate de CPF:** só ganha pontos quem tem **CPF cadastrado** (evita duplicação).
- **Pontos em Dobro:** produtos ou categorias em campanha pontuam 2×; o multiplicador
  é **congelado no momento da compra**.
- **Compra:** pontos creditados na **entrega** do pedido (ou na **quitação** da venda
  PDV), com guard `pointsAwarded` para nunca creditar em dobro.

### 8.2 Resgate de recompensas

- Custo de resgate = **valor × 200 pontos** (R$ 1 ≈ 200 pts), calculado pelo motor
  `computeRedemption` com prioridade:
  1. `redeemDisabled` vence tudo → bloqueado;
  2. override manual (`loyaltyPointsOverride`) → elegível, ignora fórmula/margem;
  3. produto sem custo cadastrado → bloqueado;
  4. **margem < 20%** (`MIN_REDEMPTION_MARGIN`) → bloqueado (protege o lucro);
  5. senão → fórmula (valor × 200).
- A tela `/clube` separa "**Pode resgatar agora**" do catálogo completo.
- O resgate debita pontos, baixa estoque da recompensa e cria um pedido
  `isRedemption: true` (não baixa estoque de novo).

### 8.3 Indicação

- Cada cliente tem um **código de indicação** (`SHARK-XXXXXX`, com link).
- No cadastro, o indicado informa o código → cria vínculo `pending` (idempotente).
- A bonificação **+50 pontos** ao indicador só acontece quando o indicado conclui a
  **1ª compra paga** (`qualified`) — feita pelo servidor em transação atômica, segura
  contra corrida, e coberta tanto pela baixa manual quanto pelo webhook do Mercado Pago.

### 8.4 Manutenção automática (cron)

O cron diário `loyalty-maintenance`:
- **Expira** lotes de pontos com mais de 180 dias (nunca deixa saldo negativo).
- Credita o **bônus de aniversário** mensal (Predatory +200 / Megalodon +500) no mês
  do aniversário do cliente, 1× por período (`lastBirthdayBonusPeriod`).

---

## 9. Pagamentos

### 9.1 Abstração de gateway

Os pedidos modelam o pagamento como **`PaymentInfo`** com `method`, `provider`
(`manual` | `mercadopago`), `status`, valor, referência externa, histórico de eventos e
auditoria de quem baixou.

| Método | Provider | Como confirma |
|---|---|---|
| `pix_manual` | manual | Cliente envia comprovante no WhatsApp; admin dá baixa (`awaiting_proof` → `paid`) |
| `on_delivery` | manual | Motoboy cobra na entrega (`due_on_delivery`) |
| `credit` / `debit` | manual | Maquininha na entrega/retirada; admin dá baixa |
| `whatsapp` | manual | Tratativa direta (`in_negotiation`) |
| `loyalty` | manual | Resgate com pontos (débito automático) |
| `mercadopago` | mercadopago | PIX online via **Checkout Pro + webhook** |

### 9.2 Mercado Pago (PIX online)

Fluxo completo:

1. O checkout chama `POST /api/payments/mercadopago/create` com o `orderId`; o servidor
   cria o PIX na API do Mercado Pago (`createPixPayment`), grava `payment.providerRef`
   e devolve o QR Code (base64), o payload copia-e-cola e o ticket.
2. A confirmação chega de duas formas (redundantes e idempotentes):
   - **Webhook** `POST /api/webhooks/mercadopago` — não confia no corpo da notificação;
     busca o pagamento na API do MP (fonte da verdade) e aplica a transição.
   - **Polling** `GET /api/payments/mercadopago/status` — usado pelo cliente como
     fallback, sincroniza o status se o webhook atrasar.
3. Ao confirmar (`paid`), o pedido vai para **"Preparando"** e a indicação é qualificada.
4. Status mapeados: approved → paid; refunded/charged_back → refunded; cancelled →
   cancelled; rejected → failed.

### 9.3 Taxas de cartão (maquininha)

- Diferença percentual no crédito/débito (Lei 13.455/2017) configurável no admin.
- **Parcelamento**: tabela de taxas por parcela (padrão 2x–8x: 6,91% → 14,72%), editável;
  o acréscimo é calculado sobre o total e garantido pela identidade
  `subtotal + deliveryFee + cardFee − discount = total`.

---

## 10. Estoque e variações

- **Estoque por produto** e **por variação** (SKU).
- Baixa **automática na compra** (transação que recomputa o estoque agregado do produto);
  estorno **automático no cancelamento** (guard `stockApplied`).
- Pedidos WhatsApp só baixam o estoque após a **confirmação do cliente**.
- Resgates com pontos baixam o estoque no próprio resgate (pedido não baixa de novo).
- **Validação no checkout** bloqueia venda acima do disponível, **somando todas as
  variações/cores** de um produto no carrinho (`findStockShortages`).
- **PDV** tem travas próprias e baixa estoque item a item com movimentação.
- Vendas **canceladas** estornam estoque (guard `stockReversed`).
- Produtos **internos** têm estoque próprio gerenciado na área interna.

---

## 11. Lounge (agendamento)

- O cliente agenda pelo site (`/lounge`) escolhendo **data + horário** (slots
  configuráveis pelo admin) e informando nome, WhatsApp e nº de convidados.
- A reserva nasce como **`pending`** (o admin aprova no painel).
- **Bloqueio de conflito de horário**: cada slot reservado vira um documento na coleção
  `lounge_slots` (chave `YYYY-MM-DD_HHMM`), criado em **transação atômica** com a reserva.
- **Bloqueio de data passada** (`isPastDate`).
- Mudanças de data/horário reclamam novo slot e liberam o antigo; cancelar libera o slot;
  reativar reclama o slot de novo.

---

## 12. Automações de servidor (API, webhook e cron)

| Rota | Método | O que faz |
|---|---|---|
| `/api/auth/reset-password` | POST | Gera link de redefinição de senha (Firebase Admin) e envia e-mail customizado (Resend). Anti-enumeração (responde `ok` mesmo para e-mail inexistente). |
| `/api/cron/loyalty-maintenance` | POST/GET | Rotina diária do Clube Shark: expiração de pontos (+180 dias) e bônus de aniversário. Protegida por `CRON_SECRET`. |
| `/api/cron/orders-queue` | POST/GET | Libera pedidos `reserved` → `received` quando a loja está aberta (fila de espera fora do horário). Protegida por `CRON_SECRET`. |
| `/api/payments/mercadopago/create` | POST | Cria cobrança PIX no Mercado Pago para um pedido e grava `providerRef`. |
| `/api/payments/mercadopago/status` | GET | Polling do cliente: sincroniza o status do pagamento com a API do MP. |
| `/api/referrals/qualify` | POST | Qualifica indicação (pending → qualified) quando um pedido está pago. Cobre a baixa manual. |
| `/api/webhooks/mercadopago` | POST | Recebe notificação do MP; busca o pagamento na API (fonte da verdade) e aplica a transição idempotente. |

Todas as baixas convergem para operações **idempotentes**, e os créditos (pontos e
indicação) têm guards de "uma única vez".

---

## 13. Banco de dados (Firestore)

Coleções principais:

| Coleção | Conteúdo |
|---|---|
| `users` | Perfis (role, endereços, pontos, CPF, aniversário, código de indicação, comissão) |
| `products` | Catálogo (variações, estoque, custo, pontos) |
| `categories` | Categorias dinâmicas (com `_meta` de inicialização e "Pontos em Dobro") |
| `orders` | Pedidos da loja (status, pagamento, histórico, rastreio) |
| `sales` | Vendas do PDV (pagamento/fiado, auditoria, recebimentos, comissão) |
| `stockMovements` | Movimentações de estoque (entrada, saída, ajuste, perda) |
| `lounge_bookings` | Reservas do lounge |
| `lounge_slots` | Trava atômica de horários do lounge |
| `deliveryAreas` | Tabela de frete por bairro |
| `coupons` / `couponRedemptions` | Cupons de desconto e registro de usos |
| `loyaltyTransactions` | Extrato de pontos (ganhos, resgates, ajustes, expirações) |
| `referralCodes` / `referrals` | Códigos de indicação e vínculos indicador→indicado |
| `announcements` | Avisos/promoções globais |
| `notifications` | Notificações in-app por usuário |
| `events` | Eventos (imagem no Storage) |
| `reviews` | Avaliações de pedidos |
| `reports` | Problemas reportados pelos usuários |
| `settings/site` | Configurações do site (seções, pagamento, carrinho, popup, horário) |
| `banners` | Banners do CMS |

Índices compostos estão versionados em `firestore.indexes.json` (7 índices).

---

## 14. Regras de segurança

Regras do Firestore (`firestore.rules`) por coleção e papel:

- **Clientes** leem produtos/categorias/bairros/settings públicos e **seus próprios**
  pedidos, avaliações, notificações e transações de pontos.
- **Vendedores/PDV** gravam vendas e movimentações de estoque.
- **Admin** tem acesso amplo (produtos, pedidos, usuários, cupons, configurações, etc.).
- **Motoboy** só "pega" entrega **sem dono** (`motoboyId == null`) — anti-corrida.
- **Indicação bonificada** só pode ser feita pelo **servidor** (Admin SDK) — nunca pelo
  cliente — e exige pedido real pago (1ª compra).
- **Cupom** limitado por CPF nas regras (anti-abuso).

---

## 15. Deploy e operação

### Configuração do host

1. Configure **todas** as env vars (incluindo `NEXT_PUBLIC_APP_URL` e as chaves do
   Firebase Admin para os cron/webhooks).
2. Autorize os domínios do app no Firebase Auth.
3. Faça o deploy das regras e índices:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Build/deploy do app (ex.: Vercel). O `vercel.json` agenda os **crons diários**
   (`loyalty-maintenance` e `orders-queue` às 16h).

### Smoke test

Siga o roteiro em `SMOKE_TEST.md` para validar em produção: cadastro/login, catálogo,
carrinho, checkout, pagamentos, rastreio, lounge, PDV, estoque, fidelidade, cron e webhook.

---

## 16. Testes automatizados

Testes de lógica pura com **Vitest**:

| Arquivo | O que cobre |
|---|---|
| `src/lib/stock.test.ts` | Validação de estoque (incl. soma de cores/variações) |
| `src/stores/cartStore.test.ts` | Carrinho, totais e merge de persistência |
| `src/lib/booking.test.ts` | Slot, data passada e validação de reserva do lounge |
| `src/lib/coupons.test.ts` | Motor de cupons (expiração, mínimo, CPF, categorias) |
| `src/lib/cpf.test.ts` | Validação e formatação de CPF |
| `src/lib/csvImport.test.ts` | Parse de CSV e agrupamento em variações |
| `src/lib/spreadsheetImport.test.ts` | Leitura de CSV/Excel |
| `src/lib/loyalty/levels.test.ts` | Níveis, pontos por R$, expiração, bônus de aniversário |
| `src/lib/loyalty/redemption.test.ts` | Regras de resgate (margem, override, bloqueios) |

```bash
npm test
```

---

## 17. Fluxos de negócio detalhados

### 17.1 Compra na loja (online)

```
Catálogo → Modal (variação) → Carrinho → Checkout
  ├─ endereço + CEP (ViaCEP) + frete por bairro
  ├─ cupom (validação em tempo real)
  ├─ forma de pagamento (PIX manual / MP / entrega / cartão / WhatsApp / pontos)
  ├─ validação de estoque (soma variações)
  ├─ loja fechada? → pedido entra na fila `reserved`
  └─ pedido criado → baixa de estoque automática (ou na confirmação WhatsApp)
        → admin acompanha em tempo real → status atualizado → notificação ao cliente
        → entregue → pontos creditados (guard único) → cliente avalia
```

### 17.2 Venda no balcão (PDV)

```
Busca produto (ou leitor de barras) → quantidade (mini calculadora)
  → cliente (busca/cadastro rápido) → cupom/desconto manual
  → forma de pagamento (PIX/crédito/débito/dinheiro) → fiado/parcial?
  → venda registrada com auditoria → baixa de estoque por item
  → pontos creditados ao quitar → comissão do vendedor derivada
  → se cancelar: estorna estoque e reverte pontos (guards)
```

### 17.3 Pedido via Mercado Pago

```
Checkout escolhe PIX online → POST /api/payments/mercadopago/create → QR Code exibido
  → cliente paga → webhook OU polling confirma
  → syncMercadoPagoPayment (idempotente) → status paid → pedido "Preparando"
  → indicação qualificada (1ª compra)
```

### 17.4 Fidelidade

```
Cadastro (+50 boas-vindas, código de indicação, CPF)
  → compra (multiplicador congelado, taxa por nível) → pontos na entrega
  → resgate (valor × 200, margem ≥ 20%, override/disable)
  → expiração automática em 180 dias → bônus de aniversário mensal
  → indicação: 1ª compra paga do indicado → +50 ao indicador
```

---

> **Obs.:** a branch principal é `main` e o repositório tem histórico de features
> (PDV compartilhado, área interna, gráfico de rosca, notificações, rastreio em tempo
> real, cupons, horário de funcionamento etc.). Consulte `README.md`, `AGENTS.md` e
> `SMOKE_TEST.md` para informações complementares de operação.
