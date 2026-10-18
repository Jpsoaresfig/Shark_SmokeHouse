# 🦈 Shark Smokehouse

E-commerce + lounge da Shark Smokehouse (tabacaria): catálogo, carrinho, checkout,
programa de fidelidade, agendamento de lounge, marketing/CRM e um painel administrativo
completo (produtos, pedidos, PDV, estoque, financeiro/BI, eventos, vitrine, central de
operações).

Construído com **Next.js (App Router)**, **React**, **TypeScript** e **Firebase**.

> A documentação completa (funcionalidades, fluxos, dados e operação) está em
> **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix UI, framer-motion, lucide-react |
| Estado | Zustand (com `persist` no carrinho) |
| Backend | Firebase — Firestore (dados), Auth (login), Storage (imagens de eventos) + **Firebase Admin SDK** nas rotas de servidor |
| Imagens | Cloudinary (upload) + loader custom do `next/image` |
| Pagamento online | Mercado Pago (PIX) com webhook |
| E-mail | Resend (redefinição de senha) |
| Testes | Vitest |

---

## 🚀 Começando

### 1. Instalar dependências
```bash
npm install
```

### 2. Variáveis de ambiente
Crie um `.env.local` na raiz:

```env
# ── Firebase (cliente) — Project Settings → Your apps → Web ──────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# ── Firebase Admin SDK (SOMENTE servidor) — service account ──────────────
# Usado por: criação de pedido, resgate, cupons, cron, webhook, health/metrics.
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── Cloudinary (upload de imagens — o preset deve ser "unsigned") ────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# ── URLs públicas ────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000    # links de redefinição de senha
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # metadata do site + notification_url do Mercado Pago

# ── Mercado Pago (opcional — habilita PIX online). NUNCA use NEXT_PUBLIC_ aqui ──
MERCADOPAGO_ACCESS_TOKEN=         # TEST-... (sandbox) ou APP_USR-... (produção)
MERCADOPAGO_WEBHOOK_SECRET=       # valida a assinatura x-signature do webhook

# ── Cron (obrigatório em produção — sem ele as rotas de cron recusam) ────
CRON_SECRET=

# ── Resend (e-mail de redefinição de senha) ──────────────────────────────
RESEND_API_KEY=
RESEND_FROM="Shark SmokeHouse <no-reply@seudominio.com>"   # opcional
```

> ⚠️ **Em produção:** `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_SITE_URL` devem ser o domínio real.
> Na Vercel, `FIREBASE_PRIVATE_KEY` pode ser colada com `\n` escapados — o código normaliza.
> O arquivo JSON da service account (`*firebase-adminsdk*.json`) está no `.gitignore` —
> **nunca** faça commit dele.

### 3. Rodar em desenvolvimento
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm test` | Roda os testes (Vitest) uma vez |
| `npm run test:watch` | Testes em modo watch |

---

## 🗂️ Estrutura

```
src/
├─ app/                  # rotas (App Router)
│  ├─ catalog/           # catálogo público
│  ├─ checkout/          # finalização de compra (pedido criado no servidor)
│  ├─ orders/            # pedidos do cliente / rastreio
│  ├─ lounge/            # agendamento do lounge + sabores/promoções
│  ├─ clube/, account/   # fidelidade, perfil, pontos, resgates
│  ├─ motoboy/           # pool de entregas
│  ├─ admin/             # painel (dashboard + 19 áreas, incl. marketing e operações)
│  └─ api/               # rotas de servidor (pedidos, resgate, cupons, MP, cron, health…)
├─ components/           # UI, shop, landing, admin (ops/, BI), layout, checkout
├─ stores/               # Zustand: cartStore, authStore, siteSettingsStore, toastStore
├─ hooks/                # useAuth, useBarcodeScanner, useNewOrderAlerts
├─ lib/
│  ├─ firebase/          # acesso a dados por coleção (+ *.server.ts com Admin SDK)
│  ├─ payments/          # gateway manual, Mercado Pago, pricing, assinatura do webhook
│  ├─ loyalty/           # níveis e resgate do Clube Shark
│  ├─ marketing/         # segmentação, automações, campanhas, métricas (puro)
│  ├─ bi/                # agregações do BI financeiro (puro)
│  ├─ sales/             # helpers do PDV
│  ├─ observability.server.ts  # logs, alertas, health check e métricas
│  └─ (booking, businessHours, coupons, cpf, stock, orderTracking, …)
├─ proxy.ts              # proteção de rotas (Next 16: substitui o middleware)
└─ types/                # tipos compartilhados
```

---

## ✨ Principais fluxos

- **Compra:** carrinho → checkout → `POST /api/orders/create` (o servidor recalcula
  preços, frete, taxa de cartão, cupom e total e grava pedido + estoque + cupom numa única
  transação) → acompanhamento no admin.
- **Pagamento:** PIX manual, PIX online (Mercado Pago + webhook), na entrega, maquininha
  (crédito/débito/parcelado), WhatsApp ou pontos.
- **Estoque:** baixa atômica na criação do pedido, estorno no cancelamento, PDV com
  travas próprias. Clientes **não** gravam em `products`.
- **Fidelidade:** pontos na entrega, resgate via `POST /api/loyalty/redeem` (transação no
  servidor), indicação, expiração e bônus de aniversário por cron.
- **Lounge:** reserva com trava atômica de horário (`lounge_slots`), bloqueio de data
  passada, sabores/promoções editáveis pelo admin.
- **Marketing/CRM:** segmentos, campanhas (app/WhatsApp), automações diárias por cron,
  cupons automáticos e métricas.
- **Operações:** reportes de usuários, saúde dos serviços, métricas e alertas
  (pedidos parados, estoque inconsistente, falhas de webhook/cron).

---

## 🔥 Firebase

As regras e índices ficam versionados na raiz:
- `firestore.rules` — permissões por coleção (cliente, vendedor, admin, motoboy).
- `firestore.indexes.json` — índices compostos das queries (8).

**Deploy (obrigatório após mudar regras/índices — e sempre junto com o deploy do código):**
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

> Código e regras mudam juntos: subir um sem o outro quebra fluxos (ex.: criação de
> pedido, resgate, limite de cupom por CPF).
>
> Um admin é qualquer usuário com `role: "admin"` no documento `users/{uid}`.

---

## 🧪 Testes

28 arquivos de teste de lógica pura com Vitest (estoque, carrinho, lounge, cupons, CPF,
importação, fidelidade, pricing, assinatura de webhook, marketing, BI, rastreio etc.).
Lista completa em [DOCUMENTATION.md §17](./DOCUMENTATION.md#17-testes-automatizados).

```bash
npm test
```

---

## 🚢 Deploy em produção

1. Configurar **todas** as env vars no host (ver acima — inclusive `CRON_SECRET`,
   Admin SDK e `MERCADOPAGO_WEBHOOK_SECRET`).
2. `firebase deploy --only firestore:rules,firestore:indexes`.
3. Build/deploy do app (Vercel). O `vercel.json` agenda 3 crons diários.
4. Configurar o webhook do Mercado Pago para `https://SEU_DOMINIO/api/webhooks/mercadopago`.
5. Seguir o **[roteiro de smoke test](./SMOKE_TEST.md)** para validar os fluxos em produção.
