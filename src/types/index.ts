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
  /** Points required to redeem this product as a loyalty reward. */
  loyaltyPoints?: number;
  /** Points the customer earns (per unit) when buying this product. */
  pointsEarned?: number;
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
export type LoyaltyTransactionType = "earned" | "referral" | "bonus" | "welcome" | "redeemed";

export interface LoyaltyTransaction {
  id: string;
  userId: string;
  type: LoyaltyTransactionType;
  points: number;
  reason: string;
  referredUserId?: string;
  rewardId?: string;
  createdAt: string;
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
  };
  updatedAt?: string;
}

/* ── Sale ────────────────────────────────────────────────── */
/** Formas de pagamento do PDV. "card" é legado (vendas antigas, antes de
 *  separar em crédito/débito) — mantido só para exibição do histórico. */
export type SalePaymentMethod = "pix" | "credit" | "debit" | "cash" | "card";

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
  total: number;
  paymentMethod: SalePaymentMethod;
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
