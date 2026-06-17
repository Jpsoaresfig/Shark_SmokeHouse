/* ── User & Auth ─────────────────────────────────────────── */
export type UserRole = "admin" | "seller" | "motoboy" | "customer";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  phone?: string;
  cpf?: string;
  /** Data de nascimento (ISO "YYYY-MM-DD"). Coletada no cadastro. */
  birthDate?: string;
  /** Quando a conta de um menor é liberada (ISO "YYYY-MM-DD" = 18º aniversário).
   *  Presente apenas para quem se cadastrou menor de idade. */
  blockedUntil?: string;
  addresses?: Address[];
  loyaltyPoints?: number;
  /** Período "YYYY-MM" do último bônus de aniversário creditado (idempotência do cron). */
  lastBirthdayBonusPeriod?: string;
  referralCode?: string;
  referredBy?: string;
  /** % de comissão sobre vendas (apenas vendedores). Ex.: 5 = 5%. */
  commissionRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

/* ── Product ─────────────────────────────────────────────── */
/** Slug da categoria do produto. Dinâmica — gerenciada no admin (coleção `categories`). */
export type ProductCategory = string;

/** Área de entrega (bairro) com taxa de frete própria. */
export interface DeliveryArea {
  id: string;
  /** Nome do bairro/cidade. */
  name: string;
  /** Taxa de frete em R$. */
  fee: number;
  /** Agrupamento: "João Pessoa" | "Região Metropolitana" (livre). */
  region?: string;
  active?: boolean;
}

/** Categoria de produto cadastrável pelo admin. */
export interface Category {
  id: string;
  /** Identificador usado no produto (Product.category) e na URL do catálogo. */
  slug: string;
  /** Nome exibido. */
  label: string;
  /** Ordem de exibição (menor primeiro). */
  order?: number;
  /** Campanha "Pontos em Dobro" (Task 3.5): compras com itens desta categoria pontuam 2×. */
  doublePoints?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  category: ProductCategory;
  tags?: string[];
  images: string[];
  stock: number;
  minStock: number;
  sku?: string;
  weight?: number;
  featured?: boolean;
  active: boolean;
  /** Marca do produto (ex.: "Zomo", "Adalya"). Visível no admin e na importação. */
  brand?: string;
  /** Tamanho/quantidade da embalagem (ex.: "50g", "Caixa c/ 10"). */
  size?: string;
  /** Custo de aquisição por unidade (R$). USO INTERNO — nunca exibido ao cliente. */
  costPrice?: number;
  /** Imposto (%) sobre o produto. USO INTERNO — nunca exibido ao cliente. */
  taxPercent?: number;
  /** Cores disponíveis (nomes) para o cliente escolher. Mesma peça, mesmo preço.
   *  @deprecated Use `variations` (com SKU e estoque por variação). Mantido para
   *  produtos antigos. */
  colors?: string[];
  /** Variações/grade do produto: mesmo preço, atributo (sabor/aroma/cor) e
   *  código de barras (SKU) diferentes, com estoque próprio por variação.
   *  Quando presente, `stock` deste produto é a SOMA dos estoques das variações. */
  variations?: ProductVariation[];
  /** Custo EFETIVO de resgate em pontos, derivado pelo motor de resgate (Task 3.6):
   *  fórmula (valor × 200) ou override. Ausente/0 = não resgatável. Persistido no
   *  save do produto para o cliente não precisar recalcular margem (dado interno). */
  loyaltyPoints?: number;
  /** Overwrite (Task 3.6): desativa o resgate deste item, independente da margem. */
  redeemDisabled?: boolean;
  /** Overwrite (Task 3.6): custo manual em pontos, ignorando a fórmula e a trava de margem. */
  loyaltyPointsOverride?: number;
  /** Points the customer earns (per unit) when buying this product. */
  pointsEarned?: number;
  /** Campanha "Pontos em Dobro" (Task 3.5): compras com este item pontuam 2×. */
  doublePoints?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Uma variação (grade) do produto: mesmo preço, atributo e SKU diferentes. */
export interface ProductVariation {
  /** id estável da variação (não muda ao renomear). */
  id: string;
  /** Nome do atributo: "Menta", "Lavanda", "Uva"… */
  name: string;
  /** Código de barras / SKU único desta variação (o que o leitor bipa). */
  sku: string;
  /** Estoque próprio desta variação. */
  stock: number;
  /** Foto própria da variação (opcional). Quando o cliente escolhe a variação,
   *  esta imagem é exibida no lugar da principal e vai para o carrinho. */
  image?: string;
}

/* ── Cart ────────────────────────────────────────────────── */
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  /** Cor/variação escolhida (exibida ao cliente). Para produtos com `variations`,
   *  recebe o NOME da variação, então pedidos/carrinho a mostram sem mudança. */
  color?: string;
  /** id da variação escolhida (quando o produto tem `variations`). */
  variationId?: string;
  /** SKU da variação escolhida (correlação com o leitor de código de barras). */
  variationSku?: string;
  notes?: string;
  /** Loyalty points earned per unit, snapshotted from the product at add-to-cart. */
  pointsEarned?: number;
  /** Multiplicador de pontos congelado na COMPRA (Task 3.5): 2 quando o produto ou
   *  sua categoria estava em campanha de "Pontos em Dobro"; 1 (ou ausente) caso contrário. */
  pointsMultiplier?: number;
}

/* ── Order ───────────────────────────────────────────────── */
export type OrderStatus =
  | "received"
  | "analyzing"
  | "approved"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/* Gateway que processa o pagamento: "manual" (baixa pelo admin) ou
   "mercadopago" (cobrança automática via Checkout Pro + webhook). */
export type PaymentProvider = "manual" | "mercadopago";

export type PaymentMethod =
  /* Gateways manuais — baixa feita pelo admin */
  | "pix_manual"   // PIX com validação externa (comprovante via WhatsApp)
  | "on_delivery"  // pagamento na entrega (cobrança pelo motoboy)
  | "credit"       // cartão de crédito na maquininha (entrega/retirada)
  | "debit"        // cartão de débito na maquininha (entrega/retirada)
  | "whatsapp"     // tratativa direta via WhatsApp
  | "loyalty"      // resgate pago com pontos de fidelidade
  /* Gateway automático — Mercado Pago Checkout Pro (PIX) */
  | "mercadopago"  // pagamento online via Mercado Pago (confirmação por webhook)
  /* legados — mantidos para pedidos antigos */
  | "online"
  | "on_arrival"
  | "pix"
  | "card"
  | "cash"
  | "pending";

export type PaymentStatus =
  | "pending"          // genérico / aguardando ação
  | "awaiting_proof"   // PIX manual: aguardando comprovante no WhatsApp
  | "in_negotiation"   // whatsapp: tratativa em andamento
  | "due_on_delivery"  // pagamento na entrega: a cobrar pelo motoboy
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

/** Evento do histórico financeiro de um pedido (auditoria das transições). */
export interface PaymentEvent {
  status: PaymentStatus;
  timestamp: string;
  note?: string;
  /** uid de quem alterou (admin). Ausente em eventos do sistema/gateway. */
  by?: string;
}

/**
 * Abstração de pagamento do pedido — modelada como gateway. Os métodos manuais
 * usam o provider "manual" (baixa pelo admin); o método "mercadopago" usa o
 * provider "mercadopago" (cobrança automática via Checkout Pro + webhook).
 */
export interface PaymentInfo {
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Snapshot do valor cobrado. */
  amount: number;
  /** Referência da cobrança externa (ex.: id da preferência do Mercado Pago). Vazio no manual. */
  providerRef?: string;
  /** Snapshot da chave PIX exibida ao cliente (pix_manual). */
  pixKey?: string;
  pixName?: string;
  /** Parcelas no cartão de crédito: 1 = à vista (direto), 2+ = parcelado em N
   *  vezes na maquininha. Só para method "credit"; ausente nos demais. */
  installments?: number;
  /** Quando o pagamento foi confirmado. */
  paidAt?: string;
  /** uid do admin que deu baixa manual. */
  confirmedBy?: string;
  history: PaymentEvent[];
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  /** Acréscimo (ou desconto, se negativo) cobrado pela forma de pagamento em
   *  cartão (crédito/débito), conforme a Lei nº 13.455/2017. Em R$. Garante que
   *  subtotal + deliveryFee + cardFee − discount = total. Ausente = 0 (pedidos antigos). */
  cardFee?: number;
  total: number;
  status: OrderStatus;
  /** Fonte canônica do pagamento (abstração de gateway). */
  payment: PaymentInfo;
  /** @deprecated Espelhos mantidos para compatibilidade com pedidos antigos.
   *  Use `payment.method` / `payment.status` e o helper resolveOrderPayment(). */
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  deliveryAddress: Address;
  motoboyId?: string;
  motoboyName?: string;
  notes?: string;
  statusHistory: StatusEvent[];
  /** Total loyalty points this order grants the customer once delivered. */
  pointsEarned?: number;
  /** Guard so purchase points are credited only once (on delivery). */
  pointsAwarded?: boolean;
  /** Pedido WhatsApp aguardando o cliente confirmar que efetuou a compra. */
  awaitingConfirmation?: boolean;
  /** Guard: estoque já foi baixado por este pedido (evita baixa/estorno em dobro). */
  stockApplied?: boolean;
  /** Pedido gerado por resgate de pontos (não baixa estoque — o resgate já baixa). */
  isRedemption?: boolean;
  /** Pontos gastos no resgate (quando isRedemption). */
  pointsRedeemed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatusEvent {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

/* ── Lounge Booking ──────────────────────────────────────── */
export type BookingStatus = "pending" | "approved" | "cancelled";

export interface LoungeBooking {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  date: string;
  time: string;
  guestCount?: number;
  notes?: string;
  status: BookingStatus;
  createdAt: string;
}

/* ── CMS ─────────────────────────────────────────────────── */
export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
  order: number;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  active: boolean;
  createdAt: string;
}

/* ── Loyalty ─────────────────────────────────────────────── */
export type LoyaltyTransactionType =
  | "earned"
  | "referral"
  | "bonus"
  | "welcome"
  | "redeemed"
  | "expired"
  | "adjustment";

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  type: LoyaltyTransactionType;
  points: number;
  reason: string;
  referredUserId?: string;
  rewardId?: string;
  /** uid de quem fez o ajuste manual (PDV/balcão). Ausente em eventos do sistema. */
  by?: string;
  createdAt: string;
}

/**
 * Vínculo persistido entre quem indicou (referrer) e quem foi indicado (referred).
 * Criado no momento do cadastro do indicado. A bonificação ao indicador NÃO é
 * creditada aqui — ela só acontece quando o indicado conclui a 1ª compra paga
 * (regra do Clube Shark / Task 3.2), que promove o status para "qualified".
 * Doc id = referredUserId (1 indicação por indicado, idempotente).
 */
export type ReferralStatus = "pending" | "qualified";

export interface Referral {
  referrerId: string;
  referredUserId: string;
  /** Código de indicação usado no cadastro (ex.: "SHARK-AB12CD"). */
  code: string;
  status: ReferralStatus;
  /** Pontos já creditados ao indicador por esta indicação (0 enquanto "pending"). */
  pointsAwarded: number;
  createdAt: string;
  /** Quando o indicado concluiu a 1ª compra paga e a indicação foi bonificada. */
  qualifiedAt?: string;
  /** Pedido (1ª compra paga) que disparou a bonificação da indicação. */
  qualifyingOrderId?: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  image?: string;
  pointsCost: number;
  stock: number;
  active: boolean;
  createdAt: string;
}

/* ── Coupon (cupom de desconto — Task 3.3) ───────────────── */
export type CouponType = "percent" | "fixed";

export interface Coupon {
  /** Doc id = code (garante unicidade e lookup direto por código). */
  id: string;
  /** Código em maiúsculas, sem espaços (ex.: "SHARK10"). */
  code: string;
  type: CouponType;
  /** % (0–100) quando type=percent; R$ quando type=fixed. */
  value: number;
  /** Valor mínimo do pedido (R$) para o cupom valer. */
  minOrder?: number;
  /** Data de expiração "YYYY-MM-DD" (inclusiva). Ausente = sem validade. */
  expiresAt?: string;
  /** Limite de usos por CPF. Ausente = ilimitado. */
  usageLimitPerCpf?: number;
  /** Slugs de categorias a que o cupom se restringe. Vazio/ausente = todas. */
  categories?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Registro de uso de um cupom (para limitar por CPF e auditar). */
export interface CouponRedemption {
  id: string;
  couponId: string;
  code: string;
  cpf: string;
  userId: string;
  orderId: string;
  discount: number;
  createdAt: string;
}

/* ── Stock Movement ──────────────────────────────────────── */
export type MovementType = "in" | "out" | "adjustment" | "loss";

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  reason: string;
  userId: string;
  createdAt: string;
  /** Variação movimentada (quando o produto tem grade). */
  variationId?: string;
  variationName?: string;
}

/* ── Site Settings ───────────────────────────────────────── */
/** Taxa de parcelamento no cartão de crédito (maquininha) para um nº de parcelas. */
export interface InstallmentFee {
  /** Número de parcelas (>= 2). 1x é à vista (direto), sem taxa de parcelamento. */
  installments: number;
  /** Taxa (%) aplicada ao total quando o cliente parcela nesse número de vezes. */
  feePercent: number;
}

export interface SiteSettings {
  sections: {
    hero: boolean;
    featuredProducts: boolean;
    lounge: boolean;
    events: boolean;
  };
  /** Dados de pagamento configuráveis pelo admin. */
  payment: {
    /** Chave PIX usada quando o cliente escolhe pagar via PIX. */
    pixKey: string;
    /** Nome do titular da chave (exibido ao cliente). */
    pixName: string;
    /** Payload PIX "copia e cola" (BR Code) — renderizado como QR Code no checkout. */
    pixQrPayload?: string;
    /** % aplicada ao pagar no CRÉDITO (Lei nº 13.455/2017 — preço diferenciado).
     *  Positivo = acréscimo; negativo = desconto; 0/ausente = sem diferença. */
    creditFeePercent?: number;
    /** % aplicada ao pagar no DÉBITO (Lei nº 13.455/2017 — preço diferenciado).
     *  Positivo = acréscimo; negativo = desconto; 0/ausente = sem diferença. */
    debitFeePercent?: number;
    /** Tabela de taxas de parcelamento no CRÉDITO (maquininha), por nº de parcelas.
     *  Editável pelo admin; define também quais parcelas aparecem no checkout.
     *  1x = à vista (direto), sem taxa de parcelamento (usa creditFeePercent). */
    creditInstallmentFees?: InstallmentFee[];
  };
  updatedAt?: string;
}

/* ── Sale ────────────────────────────────────────────────── */
/** Formas de pagamento do PDV. "card" é legado (vendas antigas, antes de
 *  separar em crédito/débito) — mantido só para exibição do histórico. */
export type SalePaymentMethod = "pix" | "credit" | "debit" | "cash" | "card";

/** Onde a venda foi feita: presencial na loja, entrega em casa (maquineta) ou online. */
export type SaleChannel = "in_store" | "delivery" | "online";

export interface SaleItem {
  productId: string;
  productName: string;
  sku?: string;
  category: ProductCategory;
  price: number;
  quantity: number;
  subtotal: number;
  /** Variação vendida (quando o produto tem grade). */
  variationId?: string;
  variationName?: string;
}

export interface Sale {
  id: string;
  sellerId: string;
  sellerName: string;
  items: SaleItem[];
  /** Total cobrado do cliente = subtotal de produtos + frete + taxa do cartão. */
  total: number;
  /** Subtotal só dos produtos (sem frete e sem taxa de cartão). Ausente em
   *  vendas antigas — nesses casos `total` já era só os produtos. */
  subtotal?: number;
  paymentMethod: SalePaymentMethod;
  /** Onde a venda foi feita. Ausente = vendas antigas (presencial por padrão). */
  channel?: SaleChannel;
  /** Frete cobrado (venda com entrega em casa). */
  deliveryFee?: number;
  /** Taxa do cartão (R$) somada ao total — crédito/débito (Lei 13.455/2017). */
  cardFee?: number;
  /** % da taxa do cartão aplicada (espelho da taxa usada no cálculo). */
  cardFeePercent?: number;
  /** Parcelas no crédito: 1 = à vista (direto), 2+ = parcelado na maquininha. */
  installments?: number;
  /** Cupom aplicado na venda (código) e o desconto concedido (R$). */
  couponCode?: string;
  discount?: number;
  /** Pontos do Clube Shark creditados ao cliente vinculado (0/ausente = nenhum). */
  pointsEarned?: number;
  notes?: string;
  /** Cliente vinculado à venda presencial (opcional — busca no cadastro). */
  customerId?: string;
  customerName?: string;
  /** Venda marcada para "Entrega Posterior" (produto não retirado na hora). */
  deliveryLater?: boolean;
  /** Quando uma venda com entrega posterior já foi entregue. */
  delivered?: boolean;
  deliveredAt?: string;
  createdAt: string;
}

/* ── Review (avaliação de pedido) ────────────────────────── */
export interface Review {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  /** Nota de 1 a 5. */
  rating: number;
  comment?: string;
  createdAt: string;
}

/* ── Commission ──────────────────────────────────────────── */
export interface Commission {
  id: string;
  sellerId: string;
  sellerName: string;
  orderId: string;
  orderTotal: number;
  rate: number;
  amount: number;
  paid: boolean;
  paidAt?: string;
  createdAt: string;
}

/* ── Report (problema reportado por usuário) ─────────────── */
export type ReportStatus = "open" | "resolved";

export interface Report {
  id: string;
  /** Descrição do problema escrita pelo usuário. */
  message: string;
  /** Rota onde o usuário estava ao reportar (ex.: "/checkout"). */
  page: string;
  /** Dados de quem reportou (quando logado). */
  userId?: string;
  userName?: string;
  userEmail?: string;
  /** Navegador/dispositivo, para ajudar a reproduzir o erro. */
  userAgent?: string;
  status: ReportStatus;
  createdAt: string;
}
