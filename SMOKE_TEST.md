# Roteiro de Smoke Test — Produção

Checklist de validação manual para rodar **em produção (ou staging)** logo após o deploy.
Objetivo: confirmar que cada fluxo funciona ponta a ponta com o Firebase real.
Tempo estimado: ~20 min.

---

## 0. Pré-deploy (BLOQUEADORES — fazer ANTES de subir)

- [ ] **Deploy de regras + índices do Firestore:**
      `firebase deploy --only firestore:rules,firestore:indexes`
      _(sem isso, reservas do lounge falham — a coleção `lounge_slots` é nova)_
- [ ] **Env vars no host de produção** (Vercel/etc.), todas as 10:
      - [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
      - [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
      - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
      - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
      - [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
      - [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`
      - [ ] `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
      - [ ] `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
      - [ ] `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
      - [ ] `NEXT_PUBLIC_APP_URL` = `https://SEUDOMINIO.com` **(estava faltando!)**
- [ ] **Cloudinary upload preset** está como **unsigned** (senão upload de imagem falha).
- [ ] Existe **pelo menos 1 usuário admin** (campo `role: "admin"` no doc `users/{uid}`).
- [ ] Domínio de produção adicionado em **Firebase Auth → Settings → Authorized domains**.

---

## 1. Autenticação
- [ ] **Registrar** uma conta nova → redireciona logado.
- [ ] **Logout** e **login** de novo com a mesma conta.
- [ ] **Esqueci a senha** → e-mail chega e o link aponta para **seu domínio** (não `localhost`).
      _(valida a `NEXT_PUBLIC_APP_URL`)_

## 2. Catálogo e Carrinho
- [ ] Home e `/catalog` carregam com produtos e **imagens** aparecendo.
- [ ] Adicionar produto **sem cor** ao carrinho → aparece no drawer.
- [ ] Produto **com cor/estampa** → abre o modal, exige escolher cor, adiciona com a cor.
- [ ] Mesmo produto em **2 cores** → vira **2 linhas** no carrinho.
- [ ] Alterar quantidade e remover item → totais e frete recalculam (frete grátis ≥ R$150).

## 3. Compra (checkout) — fluxo crítico
- [ ] Finalizar com **PIX** → tela de sucesso com chave PIX.
- [ ] Conferir no **admin/pedidos** que o pedido apareceu com os itens + **cor** corretos.
- [ ] Conferir que o **estoque baixou** (admin/produtos) na quantidade comprada.
- [ ] **Teste de estoque insuficiente:** colocar no carrinho mais do que há em estoque
      (ou somar 2 cores além do estoque) → finalização é **bloqueada** com aviso. ✅
- [ ] Pedido via **WhatsApp** → fica "aguardando confirmação"; confirmar → estoque baixa.

## 4. Pontos de fidelidade
- [ ] Admin marca um pedido como **entregue** → pontos creditados ao cliente (uma vez só).
- [ ] Cliente com pontos faz um **resgate** → pontos debitam, estoque da recompensa baixa,
      e um pedido de resgate aparece no admin.

## 5. Vendedor / PDV (admin/sales)
- [ ] Adicionar produtos a uma venda → não deixa passar do estoque.
- [ ] Registrar a venda → estoque baixa e a venda aparece no histórico.
- [ ] Exportar **CSV** abre corretamente (acentos OK).

## 6. Agendamento do Lounge — fluxo novo
- [ ] Abrir `/lounge`, escolher uma **data** → horários carregam.
- [ ] Fazer uma reserva → tela "Pedido Enviado!".
- [ ] **Conflito:** voltar, escolher a **mesma data** → o horário reservado aparece
      **riscado/desabilitado**. ✅
- [ ] **Data passada:** o seletor de data não deixa escolher dia anterior a hoje. ✅
- [ ] No **admin/lounge**: a reserva aparece; **cancelar** → o horário **reabre** no site;
      **reabrir** a cancelada → reclama o horário (ou avisa se já foi pego).

## 7. Admin geral
- [ ] **Produtos:** criar/editar com upload de imagem (Cloudinary) e cores; ativar/desativar.
- [ ] **Eventos:** criar com imagem; aparece em `/events`.
- [ ] **Seções (CMS):** ligar/desligar uma seção reflete no site.
- [ ] **Pagamentos / Pedidos / Avaliações / Usuários:** abrem sem erro de permissão.
- [ ] Navegação **mobile** do admin (barra inferior) funciona.

## 8. Saúde geral
- [ ] Abrir o **console do navegador** durante os testes → sem erros vermelhos de
      `permission-denied` (regra faltando) ou `requires an index` (índice faltando).
- [ ] Testar em **celular real** (a maior parte do tráfego é mobile).

---

### Se algo falhar
- **`Missing or insufficient permissions`** → faltou deploy das **regras** ou o usuário não tem o `role` certo.
- **`The query requires an index`** → faltou deploy dos **índices** (o erro traz um link que cria o índice).
- **Imagem não sobe** → env vars do **Cloudinary** ou preset não-unsigned.
- **Link de senha vai pra localhost** → faltou `NEXT_PUBLIC_APP_URL` em produção.
- **App não carrega / tela branca** → falta alguma env var do **Firebase** no host.
