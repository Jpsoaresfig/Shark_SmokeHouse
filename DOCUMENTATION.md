# 🦈 Shark Smokehouse — Documentação Completa do Sistema

> Documentação técnica e funcional do sistema **Shark Smokehouse** — e-commerce + lounge
> de uma tabacaria em João Pessoa/PB. Este documento descreve todas as funcionalidades,
> a arquitetura, os fluxos de negócio, os dados e a operação do sistema.
>
> **Última revisão:** 18/10/2026 (inclui a auditoria de segurança de 10/10/2026, o módulo
> de marketing/CRM, a central de operações e o BI financeiro).

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Como rodar o projeto](#3-como-rodar-o-projeto)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Papéis de usuário](#5-papéis-de-usuário)
6. [Funcionalidades do cliente (loja)](#6-funcionalidades-do-cliente-loja)
7. [Painel administrativo](#7-painel-administrativo)
8. [Marketing / CRM](#8-marketing--crm)
9. [Central de Operações (observabilidade)](#9-central-de-operações-observabilidade)
10. [Programa de fidelidade (Clube Shark)](#10-programa-de-fidelidade-clube-shark)
11. [Pagamentos](#11-pagamentos)
12. [Estoque e variações](#12-estoque-e-variações)
13. [Lounge (agendamento)](#13-lounge-agendamento)
14. [Rotas de servidor (API, webhook e cron)](#14-rotas-de-servidor-api-webhook-e-cron)
15. [Banco de dados (Firestore)](#15-banco-de-dados-firestore)
16. [Regras de segurança](#16-regras-de-segurança)
17. [Testes automatizados](#17-testes-automatizados)
18. [Deploy e operação](#18-deploy-e-operação)
19. [Fluxos de negócio detalhados](#19-fluxos-de-negócio-detalhados)

---

## 1. Visão geral

O Shark Smokehouse é um sistema completo de **e-commerce + lounge** para uma tabacaria.
Ele cobre toda a operação comercial em uma única aplicação:

- **Para o cliente:** catálogo de produtos, carrinho, checkout com várias formas de
  pagamento, rastreio de pedidos em tempo real, agendamento do lounge (com cardápio de
  sabores), programa de fidelidade (pontos, níveis, resgates e indicação), eventos,
  notificações e suporte.
- **Para a loja:** um painel administrativo com gestão de produtos, pedidos, PDV
  (ponto de venda de balcão), estoque, contas a receber, financeiro/BI, cupons, marketing
  (campanhas, automações e segmentos), agenda do lounge, entregas, motoboys, vendedores,
  avaliações, eventos, avisos, conteúdo da vitrine, configurações do site e uma central
  de operações (reportes, saúde do sistema e alertas).
- **Para o motoboy:** uma área própria para visualizar e "pegar" entregas disponíveis.

Construído com **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**,
**Firebase** (Firestore, Auth, Storage, Admin SDK) e **Mercado Pago** (PIX online).

Dados da empresa utilizados no sistema (endereço, telefone e horários exibidos na home e
no rodapé são editáveis em **Site & Vitrine**):

| Dado | Valor |
|---|---|
| WhatsApp | 55 83 99902-0606 |
| Endereço | Rua Comerciante Alfredo Ferreira da Rocha, 742 — Mangabeira, João Pessoa/PB |
| CNPJ | 65.891.927/0001-04 |
| Fuso horário da loja | America/Fortaleza (`STORE_TIMEZONE`) |

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix UI, framer-motion, lucide-react |
| Estado | Zustand (com `persist` no carrinho) |
| Backend | Firebase — Firestore (dados), Auth (login), Storage (imagens de eventos) |
| Servidor | Route handlers do Next + **Firebase Admin SDK** (pedidos, resgate, cupons, cron, webhook, observabilidade) |
| Imagens | Cloudinary (upload de produtos/eventos/popup) + loader custom do `next/image` |
| Pagamento online | Mercado Pago (PIX) com webhook assinado + polling |
| E-mail | Resend (template de redefinição de senha) |
| Importação de produtos | `xlsx` (CSV e Excel .xlsx/.xls) |
| Agendamento | Vercel Cron (`vercel.json`) |
| Testes | Vitest (lógica pura) |

---

## 3. Como rodar o projeto

### Instalar dependências

```bash
npm install
```

### Variáveis de ambiente

Crie um `.env.local` na raiz:

```env
# Firebase (cliente) — Project Settings → Your apps → Web
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK (SOMENTE servidor)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Cloudinary (upload de imagens — preset deve ser "unsigned")
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# URLs públicas
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Mercado Pago (opcional — habilita PIX online). Somente servidor.
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Segredo dos cron jobs
CRON_SECRET=

# Resend (e-mail de redefinição de senha)
RESEND_API_KEY=
RESEND_FROM=
```

| Variável | Onde é usada | Obrigatória? |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (7) | SDK do cliente | Sim |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK (`src/lib/firebase/admin.ts`). A chave pode vir com `\n` escapado; o código normaliza. | Sim — sem elas checkout, resgate, cupons, cron e webhook falham |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `_UPLOAD_PRESET` | Upload de imagens no admin | Sim |
| `NEXT_PUBLIC_APP_URL` | Base dos links de redefinição de senha | Sim em produção |
| `NEXT_PUBLIC_SITE_URL` | `metadataBase` do site e `notification_url` do Mercado Pago (cai para `VERCEL_PROJECT_PRODUCTION_URL` se ausente) | Recomendada |
| `MERCADOPAGO_ACCESS_TOKEN` | Criação/consulta de PIX no MP. **Nunca** com prefixo `NEXT_PUBLIC_` (iria para o navegador). | Só se usar PIX online |
| `MERCADOPAGO_WEBHOOK_SECRET` | Valida o header `x-signature` do webhook | Recomendada com MP |
| `CRON_SECRET` | Autoriza as rotas `/api/cron/*` (`Authorization: Bearer`). **Em produção, sem ela as rotas recusam.** | Sim em produção |
| `RESEND_API_KEY` | Envio do e-mail de redefinição de senha | Sim |
| `RESEND_FROM` | Remetente do e-mail (padrão `Shark SmokeHouse <onboarding@resend.dev>`) | Opcional |

`VERCEL_URL`, `VERCEL_BRANCH_URL` e `VERCEL_PROJECT_PRODUCTION_URL` são injetadas pela
Vercel e usadas como fallback/allowlist de host.

> **Atenção:** o JSON da service account (`*firebase-adminsdk*.json`) está no `.gitignore`.
> Nunca faça commit dele; copie os campos para as variáveis acima.

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
│  ├─ admin/                # painel administrativo (dashboard + 19 áreas)
│  │  └─ marketing/         # campanhas, automações, segmentos, contatos, cupons, histórico
│  ├─ api/                  # rotas de servidor (ver §14)
│  ├─ about, contact, events, privacy, terms
│  ├─ account/              # perfil, pontos, resgates
│  ├─ cart/, checkout/      # carrinho e finalização de compra
│  ├─ catalog/              # catálogo público
│  ├─ clube/                # programa de fidelidade
│  ├─ login, register, forgot-password, reset-password
│  ├─ lounge/               # agendamento do lounge + sabores
│  ├─ motoboy/              # área do motoboy
│  └─ orders/               # meus pedidos / rastreio
├─ components/              # UI, shop, landing, admin (ops/, BiAnalytics), layout, checkout
├─ stores/                  # Zustand: cartStore, authStore, siteSettingsStore, toastStore
├─ hooks/                   # useAuth, useBarcodeScanner, useNewOrderAlerts
├─ providers/               # AuthProvider
├─ lib/
│  ├─ firebase/             # acesso a dados por coleção
│  │                        #   *.server.ts e admin.ts = Admin SDK (só servidor)
│  ├─ payments/             # gateway manual, Mercado Pago, pricing, installments,
│  │                        #   webhookSignature
│  ├─ loyalty/              # motor de níveis e resgate do Clube Shark
│  ├─ marketing/            # segmentação, planner, prioridades/anti-spam, métricas,
│  │                        #   templates, WhatsApp, server.ts (cron)
│  ├─ bi/                   # agregação, períodos, insights e exportação do BI
│  ├─ sales/                # helpers do PDV
│  ├─ email/                # template do e-mail de redefinição de senha
│  ├─ observability.server.ts  # logs, alertas, health check e métricas (servidor)
│  └─ (booking, businessHours, coupons, cpf, stock, orderTracking, csvImport,
│      spreadsheetImport, age, timeAgo, requestId, …)
├─ proxy.ts                 # proteção de rotas (Next 16: "proxy" substitui o middleware)
└─ types/                   # tipos compartilhados (index.ts, marketing.ts, …)
```

---

## 5. Papéis de usuário

Cada usuário tem uma `role` gravada no documento `users/{uid}`:

| Papel | `role` | Acesso |
|---|---|---|
| **Admin (Master)** | `admin` | Todo o painel, incluindo a área interna oculta, marketing e operações. `admin@shark.com` é o admin principal. |
| **Vendedor** | `seller` | Área do vendedor + PDV (vendas do balcão), com comissão configurável. |
| **Motoboy** | `motoboy` | Área do motoboy (pool de entregas). |
| **Cliente** | `customer` | Loja, conta, pedidos, clube, lounge. |

A área `/admin` exige login (checado no `proxy.ts`); a checagem de papel é feita no
cliente e, para dados sensíveis, **no servidor e nas regras**. Vendedores são
redirecionados para `/admin/seller` e bloqueados da área interna (`/admin/internal`)
mesmo digitando a URL. As rotas `/api/health` e `/api/metrics` validam o ID token e a
role `admin` no servidor.

---

## 6. Funcionalidades do cliente (loja)

### 6.1 Home (landing page)

A home é montada a partir das configurações do CMS (`settings/site`) e dos dados do
Firestore, com seções que podem ser **ligadas/desligadas pelo admin**:

- **Hero / Banner principal** (`hero`)
- **Produtos em Destaque** (`featuredProducts`) — produtos marcados como `featured`
- **Nossos Produtos** (`StoreProducts`) — vitrine com destaque de produtos (`storeHighlight`)
- **Lounge / Agendamento** (`lounge`) — desativar remove a seção de todo o site,
  incluindo menu, rodapé e página de agendamento
- **Próximos Eventos** (`events`)
- **Bloco institucional** — texto "sobre", endereço, telefone e horários vindos de
  `settings/site.vitrine` (os mesmos dados aparecem no **rodapé**, sempre em sincronia;
  ausentes = padrões em `DEFAULT_VITRINE`)
- **Horário de funcionamento** — banner "Aberto agora" / "Fechado agora"

Elementos globais:

- **AgeGate** — confirmação de **maioridade (18+)** antes de acessar a loja.
- **Popup promocional** — configurável pelo admin (título, texto, imagem, botão e destino).
- **Anúncios / promoções** — avisos do admin aparecem no "sininho" de notificações.
- **Link "Eventos" com alerta pulsante** no menu quando existe evento próximo ou em andamento.
- **CTA de WhatsApp** para contato direto.

### 6.2 Catálogo

- Lista de produtos ativos (produtos `internal` **nunca** aparecem para o cliente).
- **Filtros por categoria** (dinâmica) e **busca por texto**.
- **Modal de produto**: galeria, descrição, escolha de **cor/variação** (sabor/aroma/cor
  com **foto própria** e estoque próprio), badge de desconto (`compareAtPrice`) e nota de
  quantos pontos o cliente ganha.
- Cada variação escolhida vira uma **linha separada no carrinho**.

### 6.3 Carrinho

- Drawer lateral e página `/cart` (persistido em `localStorage` via Zustand).
- Ajuste de quantidade, remoção, nota por item.
- **Barra de frete grátis**: quando ativada pelo admin, mostra o progresso até o subtotal
  mínimo (padrão R$ 150) e zera o frete ao atingi-lo.
- Para clientes logados, o `MarketingCartTracker` grava uma sessão em `marketingCartSessions`
  (usada pela automação de **carrinho abandonado** — ver §8).

### 6.4 Checkout (`/checkout`)

1. **Dados do cliente** — nome, telefone, CPF (obrigatório para ganhar pontos), endereço
   (CEP via ViaCEP, bairro para o frete).
2. **Frete por bairro** — tabela `deliveryAreas` (gerida no admin).
3. **Cupom** — validação em tempo real (ativo, não expirado, mínimo, categorias). O
   **limite por CPF** é conferido no servidor por `POST /api/coupons/usage`, porque
   `couponRedemptions` guarda CPFs e não é legível pelo cliente.
4. **Formas de pagamento**:
   - **PIX manual** (`pix_manual`) — chave PIX e/ou QR Code "copia e cola"; comprovante
     via WhatsApp e baixa pelo admin.
   - **Mercado Pago (PIX online)** (`mercadopago`) — QR Code gerado na API do MP,
     confirmação via webhook/polling.
   - **Pagamento na entrega** (`on_delivery`).
   - **Crédito na maquininha** (`credit`) — taxa configurável (Lei 13.455/2017) e
     **parcelamento** (tabela editável).
   - **Débito na maquininha** (`debit`) — diferença configurável.
   - **WhatsApp** (`whatsapp`) — o pedido fica `awaitingConfirmation` até o cliente
     confirmar (`POST /api/orders/confirm-whatsapp`), só então o estoque é baixado.
   - **Resgate com pontos** (`loyalty`).
5. **Criação no servidor** — o checkout chama **`POST /api/orders/create`** com o ID
   token. O servidor (`createOrderAdmin`, `lib/firebase/orderCreate.server.ts`):
   - pega o `uid` do token (nunca do corpo);
   - **recalcula** preços, frete, taxa de cartão, cupom e total a partir do
     catálogo/configurações (`checkOrderPricing`) — divergência = recusa;
   - monta o pagamento (status inicial nunca "pago");
   - grava **estoque, pedido e uso do cupom numa única transação**, bloqueando venda acima
     do disponível (somando todas as variações).
6. **Horário de funcionamento** — com a loja **fechada**, o pedido entra na fila
   `reserved` e é liberado pelo cron `orders-queue`.
7. **Tela de sucesso** com resumo por forma de pagamento.

### 6.5 Meus pedidos e rastreio (`/orders`)

- Lista com **atualização em tempo real** (onSnapshot).
- **Linha do tempo**:
  `reserved → received → analyzing → approved → preparing → out_for_delivery → delivered`
  (ou `cancelled`), com tempos por etapa (`lib/orderTracking.ts`).
- Botão para **confirmar pedidos WhatsApp**.
- **Avaliação do pedido** (1 a 5 + comentário).
- **Notificações** a cada mudança de status.

### 6.6 Programa de fidelidade — Clube Shark (`/clube` e `/account`)

Ver [§10](#10-programa-de-fidelidade-clube-shark).

### 6.7 Conta do cliente (`/account`)

- Perfil editável (nome, telefone, CPF, foto) e **preferência de marketing**
  (`marketingOptOut` — LGPD: quem recusa não recebe mensagens promocionais).
- **Endereços** salvos (com padrão).
- Saldo de **pontos**, extrato, nível atual e progresso.

### 6.8 Login, cadastro e recuperação de senha

- **Login** com e-mail/senha e **Google**.
- **Cadastro** com aceite de maioridade, termos e privacidade, **código de indicação** e
  data de nascimento. Menores de 18 ficam **bloqueados até o aniversário**
  (`blockedUntil`, com auto-liberação).
- **Esqueci minha senha** — `POST /api/auth/reset-password` envia e-mail (Resend) com
  link para `/reset-password`. O host do link só vem de uma **allowlist** (env/Vercel ou
  localhost) para evitar *host header injection*.

### 6.9 Motoboy (`/motoboy`)

- **Pool de entregas** (pedidos sem motoboy), em tempo real.
- **"Pegar" entrega** via transação atômica (anti-corrida).
- Acompanha suas entregas e atualiza o status.

### 6.10 Lounge (`/lounge`)

- Agendamento (ver [§13](#13-lounge-agendamento)).
- **Cardápio de sabores/essências** com preço (ou "consulte na casa") e rótulo de
  promoção opcional, editável pelo admin.

### 6.11 Eventos (`/events`)

- Agenda de eventos com **data de início e de encerramento opcional** (`endDate`) —
  eventos de vários dias continuam como "em andamento" até o fim. Datas tratadas no fuso
  local (correção UTC/local).

### 6.12 Outras páginas

- **Sobre** (`/about`), **Contato** (`/contact`), **Privacidade** (`/privacy`) e
  **Termos** (`/terms`).
- **Reporte de problemas** — botão flutuante que captura contexto técnico (URL, viewport,
  tela, idioma, plataforma, fuso, referrer, online/offline) e envia para a central de
  operações.

### 6.13 Notificações in-app

- **Sininho** com abas **Pedidos** e **Promoções**.
- Notificações por status de pedido, avisos globais e **notificações de campanhas**
  de marketing (o toque é registrado via `POST /api/marketing/events` para medir CTR).

---

## 7. Painel administrativo

> Acesso: `/admin`. Requer login. Admin = role `admin`; vendedor = `seller` (área própria).

### 7.1 Dashboard (`/admin`)

- **Métricas** de pedidos, vendas PDV, usuários, produtos e estoque.
- **Alertas de pedido novo** — som, notificação do sistema e toast.
- **Faturamento por mês** com gráfico e **rosca configurável**.
- **Status da loja** e fila de pedidos reservados.
- **Popup de pedidos parados** (`StuckOrdersDialog`, montado no layout do admin) — lista
  pedidos sem conclusão há tempo demais em um status, com o tempo parado.
- Vendas internas ficam fora das métricas.

### 7.2 Pedidos (`/admin/orders`)

- Lista em tempo real com filtros por status e forma de pagamento.
- **Mudança de status** (funil sem retrocesso), estorno de estoque no cancelamento (guard
  anti-duplicidade) e notificação ao cliente.
- **Baixa financeira manual** (ao marcar `paid`, chama `/api/referrals/qualify`).
- **Atribuir motoboy**, **creditar pontos** na entrega (guard único).
- **Aviso no WhatsApp**: botões "Saiu para entrega" e "Pedido chegou" com mensagem pronta.
- Histórico de status (`statusHistory`) e de pagamento (`payment.history`).

### 7.3 Vendas / PDV (`/admin/sales`)

Ponto de venda de balcão (componente `SalePdv`, compartilhado com a área interna):

- Busca rápida e **leitor de código de barras** (SKU via HID); mini calculadora.
- **Cadastro rápido de cliente** (`createWalkInCustomer`).
- Pagamento: PIX, crédito, débito, dinheiro (e cartão legado).
- **Fiado / parcial / pendente** com vencimento.
- **Desconto manual** (motivo obrigatório) e **cupom**.
- **Entrega posterior**.
- **Pontos**: creditados ao quitar, revertidos no cancelamento.
- **Comissão de vendedor**: % (`commissionRate`) calculada sobre as vendas do vendedor.
- **Cancelamento** com estorno de estoque (`stockReversed`) e pontos (`pointsReversed`).
- **Auditoria** da venda (`audit`).
- **Exportação CSV** de vendas e ranking.

### 7.4 Estoque (`/admin/inventory`)

- Quantidades e **alerta de estoque baixo** (`stock <= minStock`).
- **Movimentações tipadas**: `in`, `out`, `adjustment`, `loss` — com motivo e usuário.
- Histórico recente; separação de produtos normais e internos.

### 7.5 Produtos (`/admin/products`)

- Campos: nome, slug, descrições, preço, preço comparativo, categoria, tags, imagens
  (Cloudinary), estoque, estoque mínimo, SKU, marca, tamanho, destaque, vitrine, ativo,
  interno.
- **Custo de aquisição e imposto** ficam em **`productCosts/{productId}`** (legível só pela
  equipe), não no documento público do produto. Produtos antigos com custo no doc público
  são **migrados automaticamente** no primeiro carregamento do admin.
- **Variações**: atributo (sabor/aroma/cor), SKU, estoque e galeria próprios.
- **Cores** (legado) com **foto por cor**.
- **Pontos**: "Gera pontos", custo de resgate automático (valor × 200) com trava de margem,
  override manual e desativação por produto. **Pontos em Dobro** por produto/categoria.
- **Importação em massa** (CSV/Excel) agrupando variações.
- **Categorias**: criar, renomear, excluir, "Pontos em Dobro".

### 7.6 Agenda do Lounge (`/admin/lounge`)

- **Calendário mensal** com reservas (`pending`/`approved`/`cancelled`) e painel do dia.
- Criar, editar, excluir, aprovar/reprovar/cancelar.
- **Horários disponíveis para reserva** (`settings/site.lounge.timeSlots`).
- **Sabores disponíveis & Promoções** (`settings/site.lounge.flavors`): nome, preço
  (ou vazio = "consulte") e rótulo de promoção.
- Conflito de horário via `lounge_slots`.

### 7.7 Usuários (`/admin/users`)

- Clientes, vendedores e motoboys; **criar funcionários**.
- Editar perfil, **mudar role**, **comissão**.
- **Ajuste manual de pontos** (com motivo e auditoria). Excluir usuário.

### 7.8 Financeiro / BI (`/admin/financial`)

Relatórios financeiros com 4 abas, agregando **PDV + loja online** (motor puro em
`src/lib/bi/*`, componentes em `BiAnalytics`):

- **Resumo** — faturamento bruto (competência), recebido (caixa), a receber, descontos,
  custo das vendas, lucro projetado e realizado; rosca configurável e caixa por forma de
  pagamento.
- **Vendas** — evolução por período e **ranking de produtos com filtro por marca**.
- **Operação** — indicadores operacionais por período.
- **Estoque** — visão de estoque/valor.
- Lucro calculado a partir do **custo congelado** em cada venda e do imposto.
- Insights automáticos e **exportação** dos dados.

### 7.9 Pagamentos — configuração (`/admin/payments`)

- **Chave PIX** + titular + **PIX copia e cola** com prévia do QR Code.
- **Diferença no crédito/débito (%)**.
- **Parcelamento** — tabela de taxas por parcela.

### 7.10 Contas a Receber (`/admin/receivables`)

- Vendas `pending`/`partial` com vencimento; **receber parcial**, **quitar**, **cancelar**.

### 7.11 Cupons (`/admin/coupons`)

- CRUD; **percentual** ou **fixo**; mínimo, expiração, **limite por CPF**, **categorias**.
- Usos em `couponRedemptions`. Cupons gerados por campanhas/automações aparecem em
  **Marketing → Cupons**.

### 7.12 Operações (`/admin/reports`)

Ver [§9](#9-central-de-operações-observabilidade).

### 7.13 Site & Vitrine (`/admin/sections`)

- **Visibilidade das seções** da home.
- **Conteúdo da Página Inicial** — texto institucional, endereço, telefone e horários
  (`settings/site.vitrine`), exibidos na home e no rodapé.
- **Frete grátis** — liga/desliga + mínimo (padrão R$ 150).
- **Horário de funcionamento** — dias/horários e mensagem de "fechado".
- **Popup promocional**.

### 7.14 Avisos & Promoções (`/admin/announcements`)

- Avisos globais nas notificações (título, corpo, link, ativo/rascunho).

### 7.15 Frete por bairro (`/admin/delivery`)

- ~70 bairros de João Pessoa e região; criar, editar taxa inline, excluir, busca sem
  acentos, agrupado por região.

### 7.16 Eventos (`/admin/events`)

- CRUD com imagem, título, descrição, **data de início e data de encerramento opcional**,
  visível/oculto. Separa próximos/em andamento de passados.

### 7.17 Avaliações (`/admin/reviews`)

- Leitura das avaliações (1–5, média e total).

### 7.18 Área do Vendedor (`/admin/seller`)

- Dashboard do vendedor com suas vendas e comissão; acesso ao PDV.

### 7.19 Produtos Internos (`/admin/internal`)

Restrito ao admin. Itens de uso interno que **não aparecem na loja**. 4 abas:
**Produtos**, **Estoque**, **Venda** (PDV só com o catálogo interno) e **A Receber**.

### 7.20 Marketing (`/admin/marketing`)

Ver [§8](#8-marketing--crm).

### Navegação

- **Desktop:** barra superior (`AdminTopNav`).
- **Mobile:** barra inferior com Início, Produtos, Pedidos, Estoque, Vendas + menu "Mais"
  com as demais áreas (`AdminMobileNav`).

---

## 8. Marketing / CRM

Módulo em `/admin/marketing`, com lógica pura e testada em `src/lib/marketing/*` e
processamento diário no servidor (`/api/cron/marketing`).

### 8.1 Painel (`/admin/marketing`)

- Envios por dia, **receita de campanhas**, cupons usados por dia e composição da base.

### 8.2 Contatos (`/admin/marketing/contacts`)

- Base de clientes com métricas de compra (total gasto, nº de pedidos, ticket médio,
  última compra, nível, pontos).
- **Exportação CSV segura** (neutraliza *CSV injection*).
- Respeita `marketingOptOut` (LGPD).

### 8.3 Segmentos (`/admin/marketing/segments`)

- Tipos: **todos**, **por regras** ou **manual**.
- Campos de regra: total gasto, nº de pedidos, ticket médio, dias desde a última/primeira
  compra, valor do último pedido, aniversário em X dias, mês de aniversário, pontos
  expirando, saldo/nível, cidade, bairro, categoria/produto comprado, tem telefone, tem CPF.
  Operadores `>`, `≥`, `<`, `≤`, `=`, `≠`.
- **Presets**: VIP, recorrente, em risco, perdido, aniversariante, primeira compra,
  carrinho abandonado, pontos expirando. (Carrinho abandonado sem regras é exclusivo de
  automações.)

### 8.4 Campanhas (`/admin/marketing/campaigns`)

- Objetivo (recuperar, aumentar vendas, promover produto, aniversário, fidelidade,
  primeira compra, carrinho abandonado, promoção, pontos expirando), segmento, canal
  (**app** = notificação in-app; **WhatsApp** = link `wa.me` com mensagem pronta, envio
  manual pelo aparelho do admin), mensagem com placeholders e **cupom opcional**.
- Status: `draft` → `scheduled` → `sent` (ou `cancelled`). "Enviar agora" grava como
  rascunho até o envio concluir (evita campanha órfã).
- Métricas: envios, **toques no link / CTR**, cupons usados, receita.

### 8.5 Automações (`/admin/marketing/automations`)

Disparadas pelo cron diário, com **prioridade anti-spam** (quando o cliente se encaixa em
várias no mesmo dia, só a de maior prioridade é enviada):

| Prioridade | Automação | Gatilho |
|---|---|---|
| 1 | Boas-vindas | Novo cadastro (uma vez) |
| 2 | Primeira compra | Após a 1ª compra paga (uma vez) |
| 3 | Aniversário | X dias antes do aniversário |
| 4 | Carrinho abandonado | Itens parados há X horas (`marketingCartSessions`) |
| 5 | Pontos expirando | Pontos vencem em X dias |
| 6 | Cliente VIP | Gasto total acima do limite |
| 7 | Recuperação | Sem compra há X dias |
| 8 | Recuperação avançada | Sem compra há 60+ dias |
| 9 | Promoção de produto | Produto/categoria para um público-alvo |

Cada automação pode gerar um **cupom determinístico** por cliente. As execuções são
**idempotentes** (`marketingExecutions`, id = chave de dedup).

### 8.6 Cupons e Histórico

- **Cupons** (`/admin/marketing/coupons`) — cupons gerados por campanhas/automações e uso.
- **Histórico** (`/admin/marketing/history`) — execuções e eventos (envios, cliques,
  WhatsApp aberto/copiado, cupons criados) com trilha de auditoria.

---

## 9. Central de Operações (observabilidade)

Página `/admin/reports` (menu **"Operações"**), com 3 abas:

1. **Reportes** — problemas enviados pelo site: filtros por status e categoria (bug,
   pagamento, visual, sugestão, outro), detalhes técnicos, "copiar detalhes",
   resolver/reabrir/excluir.
2. **Sistema** — saúde dos serviços (`GET /api/health`: api, firestore, mercadopago,
   cloudinary, resend, cron) e **métricas** por período (`GET /api/metrics?period=1h|6h|24h|7d|30d`):
   requisições monitoradas, erros, webhooks, crons.
3. **Alertas** — `systemAlerts` com severidade **Crítico / Atenção / Info**, ativo ou
   resolvido.

O servidor (`src/lib/observability.server.ts`, *best-effort*: nunca derruba a operação)
grava `systemErrors`, `webhookLogs`, `cronExecutions`, `systemAlerts` e `systemMetrics`
(um doc por dia com buckets por hora e por endpoint) e detecta:

- **Pedidos parados** — limites por status: recebido/em análise 6h, aprovado 24h,
  preparando 4h, em rota 4h.
- **Inconsistência de estoque** — estoque negativo ou divergência entre o agregado do
  produto e a soma das variações (apenas detecta, nunca corrige).

---

## 10. Programa de fidelidade (Clube Shark)

### 10.1 Níveis

Fonte única em `src/lib/loyalty/levels.ts`:

| Nível | Saldo | Pontos por R$ | Bônus de aniversário |
|---|---|---|---|
| **Baby Shark** | 0 – 2.999 | 10 | — |
| **Hunter Shark** | 3.000 – 5.999 | 11 | — |
| **Predatory Shark** | 6.000 – 9.999 | 13 | +200 |
| **Megalodon** | 10.000+ | 15 | +500 |

- **Boas-vindas:** 50 pontos no cadastro (exceto admins).
- **Validade:** 180 dias (expiração em lotes, sem saldo negativo).
- **Gate de CPF:** só ganha pontos quem tem CPF.
- **Pontos em Dobro:** multiplicador **congelado na compra**.
- **Compra:** pontos na **entrega** (ou na **quitação** no PDV), guard `pointsAwarded`.

### 10.2 Resgate de recompensas

- Custo = **valor × 200 pontos**, por `computeRedemption`:
  1. `redeemDisabled` → bloqueado;
  2. `loyaltyPointsOverride` → elegível;
  3. sem custo cadastrado → bloqueado;
  4. **margem < 20%** (`MIN_REDEMPTION_MARGIN`) → bloqueado;
  5. senão → fórmula.
- `/clube` separa "**Pode resgatar agora**" do catálogo completo.
- O resgate roda **no servidor** (`POST /api/loyalty/redeem`), numa transação:
  valida o ID token, relê saldo e produto, **debita pontos, baixa 1 do estoque, grava o
  lançamento `redeemed` e cria o pedido `isRedemption: true`**. Tudo ou nada — impede
  resgate sem débito ou disputa de saldo com resgates simultâneos.

### 10.3 Indicação

- Código `SHARK-XXXXXX` por cliente; vínculo `pending` no cadastro (idempotente).
- **+50 pontos** ao indicador na **1ª compra paga** do indicado (`qualified`), feito no
  servidor em transação, via baixa manual (`/api/referrals/qualify`) ou webhook do MP.

### 10.4 Manutenção automática (cron)

`/api/cron/loyalty-maintenance` (diário): expira lotes com +180 dias e credita o bônus de
aniversário (1× por período, `lastBirthdayBonusPeriod`).

---

## 11. Pagamentos

### 11.1 Abstração de gateway

`PaymentInfo` com `method`, `provider` (`manual` | `mercadopago`), `status`, valor,
referência externa, histórico e auditoria. O pagamento inicial é **sempre montado pelo
servidor** em `/api/orders/create`.

| Método | Provider | Como confirma |
|---|---|---|
| `pix_manual` | manual | Comprovante no WhatsApp; admin dá baixa (`awaiting_proof` → `paid`) |
| `on_delivery` | manual | Motoboy cobra (`due_on_delivery`) |
| `credit` / `debit` | manual | Maquininha; admin dá baixa |
| `whatsapp` | manual | Tratativa direta (`in_negotiation`) |
| `loyalty` | manual | Resgate com pontos |
| `mercadopago` | mercadopago | PIX online + webhook/polling |

### 11.2 Mercado Pago (PIX online)

1. Pedido criado via `/api/orders/create` (provider `mercadopago`, `pending`); o checkout
   chama `POST /api/payments/mercadopago/create` (`{ orderId, payerEmail?, payerCpf? }`).
   O servidor cria o PIX, grava `payment.providerRef` e devolve QR Code (base64),
   copia-e-cola e ticket. A `notification_url` usa `NEXT_PUBLIC_SITE_URL`.
2. Confirmação por dois caminhos idempotentes (`syncMercadoPagoPayment`):
   - **Webhook** `POST /api/webhooks/mercadopago` — valida a **assinatura `x-signature`**
     quando `MERCADOPAGO_WEBHOOK_SECRET` está definida (401 se inválida; notificações IPN
     legadas sem header seguem), e **busca o pagamento na API do MP** (fonte da verdade).
     Responde 200 quando processado/sem ação e 500 só em falha real. Tudo é logado em
     `webhookLogs`.
   - **Polling** `GET /api/payments/mercadopago/status?orderId=...` — enquanto pendente,
     consulta a API do MP e aplica a confirmação.
3. `paid` → pedido "Preparando" e indicação qualificada.
4. Mapeamento: approved → paid; refunded/charged_back → refunded; cancelled → cancelled;
   rejected → failed.

### 11.3 Taxas de cartão (maquininha)

- Diferença percentual no crédito/débito configurável.
- **Parcelamento** (padrão 2x–8x: 6,91% → 14,72%), garantido pela identidade
  `subtotal + deliveryFee + cardFee − discount = total` — recalculada no servidor
  (`lib/payments/pricing.ts`).

---

## 12. Estoque e variações

- **Estoque por produto** e **por variação** (SKU).
- Baixa **atômica no servidor** na criação do pedido (mesma transação do pedido e do
  cupom); estorno no cancelamento (guard `stockApplied`).
- Clientes **não gravam** em `products` (regras negam).
- WhatsApp: baixa só na confirmação (`/api/orders/confirm-whatsapp`).
- Resgates: baixa no próprio resgate (servidor).
- Bloqueio de venda acima do disponível somando variações (`findStockShortages`).
- **PDV** com travas próprias e movimentação por item; cancelamento estorna
  (`stockReversed`).
- Inconsistências detectadas pela central de operações (§9).

---

## 13. Lounge (agendamento)

- Cliente escolhe **data + horário** (slots do admin) e informa nome, WhatsApp e convidados.
- Reserva nasce **`pending`**.
- **Conflito de horário**: documento em `lounge_slots` (chave `YYYY-MM-DD_HHMM`) criado em
  transação com a reserva.
- **Data passada** bloqueada (`isPastDate`).
- Alterar data/horário reclama o novo slot e libera o antigo; cancelar libera; reativar
  reclama de novo.
- **Sabores & promoções** configurados na Agenda do Lounge e exibidos em `/lounge`.

---

## 14. Rotas de servidor (API, webhook e cron)

Todas rodam com o Admin SDK. "ID token" = `Authorization: Bearer <Firebase ID token>`.

| Rota | Método | Auth | O que faz |
|---|---|---|---|
| `/api/orders/create` | POST | ID token do cliente | Cria o pedido do checkout: recalcula preços/frete/taxas/cupom/total e grava estoque + pedido + uso do cupom numa transação. |
| `/api/orders/confirm-whatsapp` | POST | ID token do dono | Cliente confirma pedido WhatsApp; baixa o estoque. |
| `/api/coupons/usage` | POST | ID token | Retorna quantas vezes um CPF usou um cupom (só o número). |
| `/api/loyalty/redeem` | POST | ID token | Resgate do Clube Shark em transação (pontos + estoque + lançamento + pedido). |
| `/api/referrals/qualify` | POST | — (não confia no chamador) | Qualifica indicação se o pedido estiver realmente `paid`. Idempotente. |
| `/api/auth/reset-password` | POST | — | Link de redefinição + e-mail (Resend). Anti-enumeração e allowlist de host. |
| `/api/payments/mercadopago/create` | POST | — | Cria cobrança PIX no MP para um pedido existente. |
| `/api/payments/mercadopago/status` | GET | — | Polling; sincroniza com a API do MP. |
| `/api/webhooks/mercadopago` | POST | Assinatura `x-signature` | Notificação do MP; confere na API e aplica transição idempotente. |
| `/api/marketing/events` | POST | ID token | Registra toque em notificação de campanha (`click:<notificationId>`, idempotente). |
| `/api/health` | GET | ID token + role admin | Saúde dos serviços. |
| `/api/metrics` | GET | ID token + role admin | Métricas agregadas por período. |
| `/api/cron/loyalty-maintenance` | GET/POST | `CRON_SECRET` | Expiração de pontos e bônus de aniversário. |
| `/api/cron/orders-queue` | GET/POST | `CRON_SECRET` | Libera pedidos `reserved` → `received` com a loja aberta (fuso da loja). |
| `/api/cron/marketing` | GET/POST | `CRON_SECRET` | Semeia templates, processa campanhas agendadas e automações, gera cupons, grava execuções e notificações. |

**Crons** (`vercel.json`): os três rodam diariamente em `0 16 * * *` (**16h UTC = 13h em
João Pessoa**). Sem `CRON_SECRET`, as rotas de cron só funcionam em desenvolvimento local;
em produção recusam. Cada execução é registrada em `cronExecutions`.

---

## 15. Banco de dados (Firestore)

| Coleção | Conteúdo |
|---|---|
| `users` | Perfis (role, endereços, pontos, CPF, aniversário, indicação, comissão, `marketingOptOut`) |
| `products` | Catálogo público (variações, estoque, pontos) |
| `productCosts` | Custo de aquisição e imposto por produto (**só equipe**) |
| `categories` | Categorias dinâmicas ("Pontos em Dobro") |
| `orders` | Pedidos (status, pagamento, histórico, rastreio) — **criados só pelo servidor** |
| `sales` | Vendas do PDV (fiado, auditoria, recebimentos) |
| `commissions` | Reservada nas regras (leitura pelo vendedor dono/admin); o código atual deriva a comissão das vendas |
| `stockMovements` | Movimentações de estoque |
| `lounge_bookings` / `lounge_slots` | Reservas e trava de horários do lounge |
| `deliveryAreas` | Frete por bairro |
| `coupons` / `couponRedemptions` | Cupons e usos (com CPF — não legível pelo cliente) |
| `loyaltyTransactions` | Extrato de pontos |
| `referralCodes` / `referrals` | Indicação |
| `announcements` | Avisos globais |
| `notifications` | Notificações in-app |
| `events` | Eventos (imagem no Storage; `endDate` opcional) |
| `reviews` | Avaliações |
| `reports` | Problemas reportados |
| `settings/site` | Seções, pagamento, carrinho, popup, horário, `vitrine`, `lounge` (slots e sabores) |
| `banners` | Banners do CMS |
| `marketingSegments` / `marketingCampaigns` / `marketingAutomations` | Configuração do marketing |
| `marketingTemplates` / `marketingSettings` | Templates de mensagem e ajustes |
| `marketingExecutions` / `marketingEvents` | Execuções idempotentes e eventos (envio, clique, cupom…) |
| `marketingCartSessions` | Sessões de carrinho (carrinho abandonado) |
| `systemErrors` / `systemAlerts` / `systemMetrics` | Observabilidade |
| `webhookLogs` / `cronExecutions` | Logs de webhook e de cron |

**Índices compostos** (`firestore.indexes.json`, 8):

| Coleção | Campos |
|---|---|
| `orders` | `motoboyId` ↑, `deliveryAddress.id` ↑ (pool do motoboy) |
| `orders` | `customerId` ↑, `createdAt` ↓ |
| `products` | `active` ↑, `createdAt` ↓ |
| `products` | `active` ↑, `featured` ↑, `createdAt` ↓ |
| `products` | `active` ↑, `loyaltyPoints` ↑ |
| `loyaltyTransactions` | `userId` ↑, `createdAt` ↓ |
| `sales` | `sellerId` ↑, `createdAt` ↓ |
| `events` | `active` ↑, `date` ↓ |

---

## 16. Regras de segurança

`firestore.rules` (endurecidas na auditoria de 10/10/2026):

- **Clientes** leem produtos/categorias/bairros/settings públicos e **seus próprios**
  pedidos, avaliações, notificações e transações.
- **Clientes não criam pedidos nem gravam produtos** — isso passa pelas rotas de servidor.
- **`productCosts`** e **`couponRedemptions`** não são legíveis por clientes.
- **Vendedores/PDV** gravam vendas e movimentações.
- **Admin** tem acesso amplo, incluindo marketing e observabilidade.
- **Motoboy** só pega entrega **sem dono** (`motoboyId == null`).
- **Indicação bonificada** e **resgate** só pelo servidor.
- Coleções de observabilidade e execuções de marketing são gravadas pelo servidor.

> ⚠️ Regras e código mudam juntos. Faça sempre o deploy de `firestore:rules,firestore:indexes`
> **junto** com o deploy do app, senão checkout, resgate e cupons falham com
> `permission-denied`.

---

## 17. Testes automatizados

28 arquivos de testes de lógica pura com **Vitest**:

| Arquivo | O que cobre |
|---|---|
| `src/lib/stock.test.ts` | Validação de estoque (soma de variações) |
| `src/stores/cartStore.test.ts` | Carrinho, totais e merge de persistência |
| `src/lib/booking.test.ts` | Slot, data passada e validação da reserva |
| `src/lib/businessHours.test.ts` | Loja aberta/fechada no fuso da loja |
| `src/lib/age.test.ts` | Idade e bloqueio de menores |
| `src/lib/coupons.test.ts` | Motor de cupons |
| `src/lib/cpf.test.ts` | Validação/formatação de CPF |
| `src/lib/csvImport.test.ts` | Parse de CSV e agrupamento em variações |
| `src/lib/spreadsheetImport.test.ts` | Leitura de CSV/Excel |
| `src/lib/orderTracking.test.ts` | Linha do tempo / tempo em cada status |
| `src/lib/timeAgo.test.ts` | Formatação de tempo relativo |
| `src/lib/utils.test.ts` | Utilitários gerais |
| `src/lib/firebase/cache.test.ts` | Cache de leitura do Firestore |
| `src/lib/sales/helpers.test.ts` | Helpers do PDV |
| `src/lib/payments/pricing.test.ts` | Recalculo de preço/frete/taxas/cupom/total |
| `src/lib/payments/webhookSignature.test.ts` | Assinatura `x-signature` do Mercado Pago |
| `src/lib/loyalty/levels.test.ts` | Níveis, pontos por R$, expiração, aniversário |
| `src/lib/loyalty/redemption.test.ts` | Regras de resgate |
| `src/lib/bi/aggregate.test.ts` | Agregações do BI |
| `src/lib/bi/periods.test.ts` | Períodos do BI |
| `src/lib/marketing/analytics.test.ts` | Métricas de base/contatos |
| `src/lib/marketing/ids.test.ts` | IDs determinísticos (dedup) |
| `src/lib/marketing/metrics.test.ts` | Métricas de campanhas |
| `src/lib/marketing/placeholders.test.ts` | Placeholders das mensagens |
| `src/lib/marketing/planner.test.ts` | Planejamento das automações |
| `src/lib/marketing/priorities.test.ts` | Prioridade/anti-spam |
| `src/lib/marketing/segmentation.test.ts` | Regras de segmentação |
| `src/lib/marketing/whatsapp.test.ts` | Telefone BR e links `wa.me` |

```bash
npm test
```

---

## 18. Deploy e operação

### Configuração do host

1. Configure **todas** as env vars (§3), em especial: Admin SDK, `CRON_SECRET`,
   `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` com o domínio real e, se usar PIX online,
   `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`.
2. Autorize o domínio em **Firebase Auth → Settings → Authorized domains**.
3. Deploy das regras e índices **junto com o código**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Build/deploy do app (Vercel). O `vercel.json` agenda os 3 crons diários.
5. No Mercado Pago, configure o webhook `https://SEU_DOMINIO/api/webhooks/mercadopago`
   (evento **Pagamentos**) e copie a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`.

### Smoke test

Siga `SMOKE_TEST.md`.

### Monitoramento

Acompanhe **Admin → Operações** (saúde, métricas e alertas) após o deploy e diariamente.

---

## 19. Fluxos de negócio detalhados

### 19.1 Compra na loja (online)

```
Catálogo → Modal (variação) → Carrinho → Checkout
  ├─ endereço + CEP (ViaCEP) + frete por bairro
  ├─ cupom (validação em tempo real; limite por CPF via /api/coupons/usage)
  ├─ forma de pagamento (PIX manual / MP / entrega / cartão / WhatsApp / pontos)
  └─ POST /api/orders/create
        ├─ recalcula preços/frete/taxas/cupom/total (divergência = recusa)
        ├─ loja fechada? → status `reserved` (liberado pelo cron)
        └─ transação: baixa de estoque + pedido + uso do cupom
              (WhatsApp: estoque só na confirmação do cliente)
  → admin acompanha em tempo real → status atualizado → notificação ao cliente
  → entregue → pontos creditados (guard único) → cliente avalia
```

### 19.2 Venda no balcão (PDV)

```
Busca produto (ou leitor de barras) → quantidade (mini calculadora)
  → cliente (busca/cadastro rápido) → cupom/desconto manual
  → forma de pagamento (PIX/crédito/débito/dinheiro) → fiado/parcial?
  → venda registrada com auditoria → baixa de estoque por item
  → pontos creditados ao quitar → comissão do vendedor
  → se cancelar: estorna estoque e reverte pontos (guards)
```

### 19.3 Pedido via Mercado Pago

```
/api/orders/create (provider mercadopago) → POST /api/payments/mercadopago/create
  → QR Code exibido → cliente paga
  → webhook (assinatura validada) OU polling confirma na API do MP
  → syncMercadoPagoPayment (idempotente) → paid → pedido "Preparando"
  → indicação qualificada (1ª compra)
```

### 19.4 Fidelidade

```
Cadastro (+50 boas-vindas, código de indicação, CPF)
  → compra (multiplicador congelado, taxa por nível) → pontos na entrega
  → resgate: POST /api/loyalty/redeem (transação: pontos + estoque + pedido)
  → expiração automática em 180 dias → bônus de aniversário
  → indicação: 1ª compra paga do indicado → +50 ao indicador
```

### 19.5 Marketing

```
Cron diário /api/cron/marketing
  → campanhas agendadas vencidas → envio (in-app) / fila WhatsApp
  → automações ativas → público de cada gatilho
       → anti-spam (1 automação por cliente/dia, por prioridade) → respeita opt-out
       → cupom determinístico (opcional) → execução idempotente
  → notificação in-app → toque registrado (/api/marketing/events) → CTR/receita no painel
```

---

> **Obs.:** a branch principal é `main`. Consulte `README.md`, `AGENTS.md` e
> `SMOKE_TEST.md` para informações complementares.
