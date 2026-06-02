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
export type ProductCategory =
  | "cigars"
  | "hookah"
  | "cigarettes"
  | "accessories"
  | "beverages"
  | "clothing"
  | "kits"
  | "premium";

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
  /** Cores disponíveis (nomes) para o cliente escolher. Mesma peça, mesmo preço. */
  colors?: string[];
  /** Points required to redeem this product as a loyalty reward. */
  loyaltyPoints?: number;
  /** Points the customer earns (per unit) when buying this product. */
  pointsEarned?: number;
  createdAt: string;
  updatedAt: string;
}

/* ── Cart ────────────────────────────────────────────────── */
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  /** Cor escolhida pelo cliente (quando o produto oferece cores). */
  color?: string;
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

/* Gateway que processa o pagamento. Hoje só "manual"; futuramente "asaas". */
export type PaymentProvider = "manual" | "asaas";

export type PaymentMethod =
  /* Fase 1 — gateways manuais */
  | "pix_manual"   // PIX com validação externa (comprovante via WhatsApp)
  | "on_delivery"  // pagamento na entrega (cobrança pelo motoboy)
  | "whatsapp"     // tratativa direta via WhatsApp
  | "loyalty"      // resgate pago com pontos de fidelidade
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
 * Abstração de pagamento do pedido — modelada como gateway para permitir a
 * futura integração com o Asaas (webhooks/processamento automático) sem
 * refatoração profunda. Na Fase 1 todos os métodos usam o provider "manual".
 */
export interface PaymentInfo {
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Snapshot do valor cobrado. */
  amount: number;
  /** Referência da cobrança externa (ex.: id do Asaas). Vazio no manual. */
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
  };
  updatedAt?: string;
}

/* ── Sale ────────────────────────────────────────────────── */
export type SalePaymentMethod = "pix" | "card" | "cash";

export interface SaleItem {
  productId: string;
  productName: string;
  sku?: string;
  category: ProductCategory;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  sellerId: string;
  sellerName: string;
  items: SaleItem[];
  total: number;
  paymentMethod: SalePaymentMethod;
  notes?: string;
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
