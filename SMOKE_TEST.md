# Roteiro de Smoke Test — Produção

Checklist de validação manual para rodar **em produção (ou staging)** logo após o deploy.
Objetivo: confirmar que cada fluxo funciona ponta a ponta com o Firebase real.
Tempo estimado: ~35 min.

> Revisado em 18/10/2026 — inclui criação de pedido no servidor, resgate no servidor,
> marketing, central de operações e BI.

---

## 0. Pré-deploy (BLOQUEADORES — fazer ANTES de subir)

- [ ] **Deploy de regras + índices do Firestore JUNTO com o deploy do código:**
      `firebase deploy --only firestore:rules,firestore:indexes`
      _(as regras negam criação de pedido e escrita de produto pelo cliente — código novo
      sem regras novas, ou o contrário, quebra checkout, resgate e cupons; o índice
      `orders (motoboyId, deliveryAddress.id)` é necessário para o pool do motoboy)_
- [ ] **Env vars no host de produção** (Vercel):
  - Firebase (cliente):
    - [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
    - [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    - [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    - [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
    - [ ] `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
  - Firebase Admin SDK (servidor):
    - [ ] `FIREBASE_PROJECT_ID`
    - [ ] `FIREBASE_CLIENT_EMAIL`
    - [ ] `FIREBASE_PRIVATE_KEY`
  - Imagens:
    - [ ] `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
    - [ ] `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
  - URLs:
    - [ ] `NEXT_PUBLIC_APP_URL` = `https://SEUDOMINIO.com`
    - [ ] `NEXT_PUBLIC_SITE_URL` = `https://SEUDOMINIO.com`
  - Segurança / integrações:
    - [ ] `CRON_SECRET` _(sem ele os 3 crons recusam em produção)_
    - [ ] `RESEND_API_KEY` (+ `RESEND_FROM` opcional)
    - [ ] `MERCADOPAGO_ACCESS_TOKEN` _(se usar PIX online — **sem** `NEXT_PUBLIC_`)_
    - [ ] `MERCADOPAGO_WEBHOOK_SECRET` _(se usar PIX online)_
- [ ] **Cloudinary upload preset** como **unsigned**.
- [ ] Existe **pelo menos 1 usuário admin** (`role: "admin"` em `users/{uid}`).
- [ ] Domínio de produção em **Firebase Auth → Settings → Authorized domains**.
- [ ] Webhook do Mercado Pago apontando para `https://SEUDOMINIO.com/api/webhooks/mercadopago`
      (evento **Pagamentos**).

---

## 1. Autenticação
- [ ] **Registrar** uma conta nova → redireciona logado (+50 pontos de boas-vindas).
- [ ] **Logout** e **login** de novo; **login com Google**.
- [ ] **Esqueci a senha** → e-mail chega e o link aponta para **seu domínio** (não `localhost`).

## 2. Catálogo e Carrinho
- [ ] Home e `/catalog` carregam com produtos e **imagens**.
- [ ] Home e **rodapé** mostram o texto, endereço, telefone e horários configurados em
      **Site & Vitrine**.
- [ ] Produto **sem cor** → entra no carrinho.
- [ ] Produto **com cor/estampa** → modal exige cor; a **foto muda conforme a cor**.
- [ ] Mesmo produto em **2 cores** → **2 linhas** no carrinho.
- [ ] Alterar quantidade/remover → totais e frete recalculam (frete grátis ≥ R$150, se ativo).

## 3. Compra (checkout) — fluxo crítico
- [ ] Finalizar com **PIX manual** → tela de sucesso com chave PIX.
- [ ] No DevTools → Network, a criação passou por **`/api/orders/create`** com status 200.
- [ ] **admin/pedidos**: pedido com itens + **cor** corretos e total igual ao do checkout.
- [ ] **Estoque baixou** na quantidade comprada.
- [ ] **Estoque insuficiente** (ou 2 cores somando além do estoque) → finalização
      **bloqueada** com aviso.
- [ ] **Cupom** com limite por CPF: usar até o limite → o próximo uso é recusado.
- [ ] Pagamento no **crédito parcelado** → taxa aplicada e total coerente.
- [ ] Pedido via **WhatsApp** → "aguardando confirmação"; confirmar em `/orders` →
      estoque baixa.
- [ ] **Loja fechada** (fora do horário) → pedido entra como **reservado**.

## 4. PIX online (Mercado Pago) — se habilitado
- [ ] Escolher PIX online → QR Code e copia-e-cola aparecem no checkout.
- [ ] Pagar (sandbox ou valor baixo) → em segundos a tela confirma; pedido vai para
      **"Preparando"**.
- [ ] **Admin → Operações → Sistema**: webhook registrado sem erro de assinatura.

## 5. Pontos de fidelidade
- [ ] Admin marca um pedido como **entregue** → pontos creditados (uma vez só).
- [ ] Cliente faz um **resgate** em `/clube` → passa por **`/api/loyalty/redeem`**;
      pontos debitam, estoque baixa e o pedido de resgate aparece no admin.
- [ ] Resgate sem saldo suficiente → recusado, nada é gravado.
- [ ] **Indicação:** conta nova com código de indicação → após a 1ª compra **paga**,
      o indicador ganha +50.

## 6. Vendedor / PDV (admin/sales)
- [ ] Adicionar produtos → não passa do estoque.
- [ ] Registrar venda → estoque baixa, venda no histórico.
- [ ] Venda **fiado/parcial** aparece em **A Receber**; quitar funciona.
- [ ] Exportar **CSV** (acentos OK).
- [ ] Login como **vendedor** → cai em `/admin/seller`; `/admin/internal` bloqueado.

## 7. Agendamento do Lounge
- [ ] `/lounge`: escolher **data** → horários carregam; **sabores e promoções** aparecem.
- [ ] Reservar → "Pedido Enviado!".
- [ ] **Conflito:** mesma data → horário reservado **desabilitado**.
- [ ] **Data passada** não selecionável.
- [ ] **admin/lounge**: reserva aparece; **cancelar** reabre o horário; **reabrir**
      reclama o horário (ou avisa se já foi pego).
- [ ] Editar **sabores/promoções** no admin → reflete em `/lounge`.

## 8. Admin geral
- [ ] **Produtos:** criar/editar com imagem, cores e **custo** (custo salva e reabre
      corretamente — fica em `productCosts`).
- [ ] **Eventos:** criar com imagem e **data de encerramento** → aparece em `/events` e o
      link "Eventos" do menu **pulsa**; evento de vários dias segue "em andamento" até o fim.
- [ ] **Site & Vitrine:** ligar/desligar seção; editar conteúdo da página inicial.
- [ ] **Financeiro:** abas Resumo, Vendas, Operação e Estoque carregam; ranking de produtos
      filtra por **marca**.
- [ ] **Popup de pedidos parados** aparece no admin quando há pedido parado há muito tempo.
- [ ] **Pagamentos / Pedidos / Avaliações / Usuários / Cupons / Frete:** abrem sem erro.
- [ ] Navegação **mobile** do admin (barra inferior + menu) funciona.

## 9. Marketing
- [ ] **Admin → Marketing**: painel, contatos, segmentos, campanhas, automações, cupons e
      histórico abrem sem erro.
- [ ] Criar uma **campanha in-app** para um segmento pequeno (ex.: só sua conta) → enviar →
      a notificação aparece no sininho do cliente; tocar → métrica de toques sobe.
- [ ] Campanha **WhatsApp** → abre `wa.me` com a mensagem pronta.
- [ ] Cliente com **opt-out de marketing** (em `/account`) **não** recebe a campanha.

## 10. Central de Operações (admin → Operações)
- [ ] **Reportes:** enviar um reporte pelo botão flutuante do site → aparece com página,
      autor e data; resolver, reabrir e excluir funcionam. Logado mostra nome/e-mail,
      deslogado mostra "Visitante".
- [ ] **Sistema:** saúde dos serviços (api, firestore, mercadopago, cloudinary, resend, cron)
      e métricas por período carregam.
- [ ] **Alertas:** lista carrega (vazia é OK).

## 11. Aviso de entrega no WhatsApp
- [ ] Pedido com telefone em **admin → Pedidos** → **"Saiu para entrega"** e
      **"Pedido chegou"** abrem o WhatsApp do cliente (DDI 55) com a mensagem pronta.

## 12. Crons
- [ ] Na Vercel → **Cron Jobs**: os 3 crons (`loyalty-maintenance`, `orders-queue`,
      `marketing`) aparecem (diários, 16h UTC = 13h local).
- [ ] Disparar manualmente um cron pela Vercel → execução registrada sem erro
      (Operações → Sistema).
- [ ] Acessar `https://SEUDOMINIO.com/api/cron/orders-queue` **sem** o header de
      autorização → **recusado** (401).

## 13. Saúde geral
- [ ] **Console do navegador** durante os testes → sem `permission-denied` ou
      `requires an index`.
- [ ] Testar em **celular real**.

---

### Se algo falhar
- **`Missing or insufficient permissions`** → faltou deploy das **regras** ou o usuário não
  tem o `role` certo.
- **`The query requires an index`** → faltou deploy dos **índices**.
- **Checkout/resgate/cupom retornam 500** → faltam as env vars do **Firebase Admin SDK**
  (`FIREBASE_*`) ou a `FIREBASE_PRIVATE_KEY` está mal formatada.
- **Checkout recusa por divergência de preço** → carrinho antigo com preço desatualizado;
  limpe o carrinho e tente de novo (o servidor recalcula tudo).
- **PIX online não gera QR Code** → `MERCADOPAGO_ACCESS_TOKEN` ausente/errado (lembre: sem
  `NEXT_PUBLIC_`).
- **Webhook com 401** → `MERCADOPAGO_WEBHOOK_SECRET` diferente da assinatura do painel do MP.
- **Crons não rodam** → `CRON_SECRET` ausente em produção.
- **Imagem não sobe** → env vars do **Cloudinary** ou preset não-unsigned.
- **Link de senha vai pra localhost** → faltou `NEXT_PUBLIC_APP_URL` em produção.
- **App não carrega / tela branca** → falta env var do **Firebase** no host.
