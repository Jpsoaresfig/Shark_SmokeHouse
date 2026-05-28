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
  loyaltyPoints?: number;
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
  notes?: string;
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

export type PaymentMethod = "pix" | "card" | "cash" | "pending";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryAddress: Address;
  motoboyId?: string;
  motoboyName?: string;
  notes?: string;
  statusHistory: StatusEvent[];
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
    loyalty: boolean;
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
