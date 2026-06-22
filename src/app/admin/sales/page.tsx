"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Minus, Trash2, Search, ShoppingCart,
  History, Download, Receipt, TrendingUp, Package,
  ChevronDown, ChevronUp, User, X, Truck, CheckCircle, Percent,
  Store, Globe, Ticket, Star, AlertTriangle,
  CircleDollarSign, Ban, CalendarClock, Wallet, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MiniCalculator } from "@/components/admin/MiniCalculator";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { getProducts } from "@/lib/firebase/products";
import { getSales, createSale, exportSalesCSV, markSaleDelivered, registerSalePayment, cancelSale, SALE_PAYMENT_LABELS as PAYMENT_LABELS, SALE_CHANNEL_LABELS } from "@/lib/firebase/sales";
import { SALE_PAYMENT_STATUS_LABELS, SALE_PAYMENT_STATUS_BADGE } from "@/lib/payments/labels";
import { saleStatus, saleReceivedAmount, saleOutstanding, saleIsRevenue, saleCommission as saleCommissionOf } from "@/lib/sales/helpers";
import { resetSalesData } from "@/lib/firebase/maintenance";
import { getAllUsers } from "@/lib/firebase/users";
import { getCouponByCode, countCouponUsesForCpf, recordCouponRedemption } from "@/lib/firebase/coupons";
import { getCategories } from "@/lib/firebase/categories";
import { addLoyaltyPoints } from "@/lib/firebase/loyalty";
import { computeOrderPoints, computeOrderPointsForItems } from "@/lib/loyalty/levels";
import { evaluateCoupon, normalizeCouponCode } from "@/lib/coupons";
import { useAuthStore } from "@/stores/authStore";
import { useSitePayment } from "@/stores/siteSettingsStore";
import { toast } from "@/stores/toastStore";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { normalizeInstallmentFees, installmentFeePercent, formatFeePercent, cardTotalFor } from "@/lib/payments/installments";
import type { Product, ProductVariation, Sale, SaleItem, SalePaymentMethod, SaleChannel, SalePaymentStatus, SaleManualDiscount, Coupon, UserProfile } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v === "string") return new Date(v);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(0);
}

const PAYMENT_OPTIONS: { value: SalePaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];

const CHANNEL_OPTIONS: { value: SaleChannel; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "in_store", label: "Loja",    desc: "Venda presencial no balcão",    icon: Store },
  { value: "delivery", label: "Entrega", desc: "Em casa, com maquineta",        icon: Truck },
  { value: "online",   label: "Online",  desc: "Pedido feito pela internet",    icon: Globe },
];

/** Converte um valor digitado em reais ("12,50" ou "12.50") para número. */
function parseMoney(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminSales() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"new" | "history">("new");

  /* ── Products catalogue ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  /* Taxas configuradas pelo admin (crédito/débito + tabela de parcelamento). */
  const { creditFeePercent, debitFeePercent, creditInstallmentFees } = useSitePayment();
  const installmentOptions = normalizeInstallmentFees(creditInstallmentFees);

  /* ── Current sale ── */
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payment, setPayment] = useState<SalePaymentMethod>("cash");
  const [channel, setChannel] = useState<SaleChannel>("in_store");
  /* Frete cobrado (venda com entrega em casa) — texto livre em R$. */
  const [deliveryFee, setDeliveryFee] = useState("");
  /* Parcelas no crédito: 1 = à vista (direto), 2+ = parcelado na maquininha. */
  const [creditInstallments, setCreditInstallments] = useState(1);
  /* Cupom de desconto (mesma engine do checkout). */
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  /* Desconto manual (≠ cupom): valor + tipo (%/R$) + motivo obrigatório. */
  const [manualDiscType, setManualDiscType] = useState<"fixed" | "percent">("fixed");
  const [manualDiscInput, setManualDiscInput] = useState("");
  const [manualDiscReason, setManualDiscReason] = useState("");
  /* Status do pagamento na criação: pago à vista, parcial (com sinal) ou pendente (fiado). */
  const [payStatus, setPayStatus] = useState<SalePaymentStatus>("paid");
  const [entryInput, setEntryInput] = useState("");   // sinal/entrada (status parcial)
  const [dueDate, setDueDate] = useState("");          // vencimento opcional (fiado/parcial)
  /* Cliente vinculado + vendedor responsável + entrega posterior */
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [deliveryLater, setDeliveryLater] = useState(false);

  /* ── Usuários (clientes p/ vínculo, vendedores p/ atribuição) ── */
  const [users, setUsers] = useState<UserProfile[]>([]);
  const isAdmin = user?.role === "admin";

  /* ── History ── */
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  /* ── Recebimento / cancelamento de venda (histórico) ── */
  const [payTarget, setPayTarget] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<SalePaymentMethod>("cash");
  const [paySaving, setPaySaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  /* ── Zerar dados de vendas (operação limpa para produção) ── */
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const all = await getProducts();
      setProducts(all.filter(p => p.active));
    } catch {
      toast.error("Não foi possível carregar os produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadHistory = useCallback(async (start?: string, end?: string, force = false) => {
    setLoadingHistory(true);
    try {
      setSales(await getSales(
        start ? new Date(start) : undefined,
        end ? new Date(end) : undefined,
        force,
      ));
    } catch {
      toast.error("Não foi possível carregar o histórico de vendas.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await getAllUsers());
    } catch {
      // Sem permissão / offline: o PDV segue funcionando sem vínculo de cliente.
      setUsers([]);
    }
  }, []);

  useEffect(() => { loadProducts(); loadUsers(); }, [loadProducts, loadUsers]);
  useEffect(() => {
    if (tab === "history") loadHistory(startDate, endDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Vendedor responsável começa como o próprio usuário logado.
  useEffect(() => {
    if (user?.uid && !sellerId) setSellerId(user.uid);
  }, [user, sellerId]);

  /* ── Listas derivadas de usuários ── */
  const sellers = useMemo(
    () => users.filter(u => u.role === "seller" || u.role === "admin"),
    [users],
  );
  /* Mapa uid → vendedor, para resolver a % de comissão de cada venda no histórico. */
  const sellerById = useMemo(
    () => new Map(users.map(u => [u.uid, u])),
    [users],
  );
  /** Comissão de uma venda a partir da taxa atual do vendedor. Delega ao helper
   *  puro (que só conta comissão de venda quitada e abate cupom + desconto manual). */
  const saleCommission = useCallback((sale: Sale): { rate: number; amount: number } | null => {
    return saleCommissionOf(sale, sellerById.get(sale.sellerId)?.commissionRate);
  }, [sellerById]);
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter(u => u.role === "customer")
      .filter(u =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      )
      .slice(0, 6);
  }, [users, customerQuery]);

  /* ── Derived ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.variations ?? []).some(v => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
    );
  }, [products, search]);

  /* ── Leitor de código de barras (só na aba de venda) ──
     Bipou → procura o produto pelo SKU exato e adiciona ao carrinho.
     Não achou → joga o código no campo de busca para o vendedor conferir. */
  useBarcodeScanner((code) => {
    const target = code.toLowerCase();
    // 1) tenta achar uma VARIAÇÃO pelo código de barras.
    for (const p of products) {
      const v = p.variations?.find(vr => vr.sku && vr.sku.toLowerCase() === target);
      if (v) {
        if (v.stock <= 0) {
          toast.error(`"${p.name} - ${v.name}" está sem estoque.`);
          return;
        }
        addItem(p, v);
        setSearch("");
        toast.success(`${p.name} - ${v.name} adicionado.`);
        return;
      }
    }
    // 2) produto simples pelo SKU.
    const match = products.find(p => p.sku && p.sku.toLowerCase() === target);
    if (!match) {
      setSearch(code);
      toast.error(`Nenhum produto com o código ${code}.`);
      return;
    }
    if (match.stock <= 0) {
      toast.error(`"${match.name}" está sem estoque.`);
      return;
    }
    addItem(match);
    setSearch("");
    toast.success(`${match.name} adicionado.`);
  }, { enabled: tab === "new" });

  /* Subtotal só dos produtos (base da comissão). */
  const total = useMemo(() =>
    items.reduce((s, i) => s + i.subtotal, 0), [items]);

  /* Frete só entra quando a venda é entrega em casa. */
  const deliveryFeeNum = channel === "delivery" ? parseMoney(deliveryFee) : 0;
  /* Taxa do cartão (Lei 13.455/2017): crédito à vista usa a % do crédito; crédito
     parcelado (2x+) usa a tabela; débito usa a % do débito; demais formas, zero. */
  const cardPct =
    payment === "credit"
      ? (creditInstallments > 1
          ? installmentFeePercent(creditInstallmentFees, creditInstallments)
          : (creditFeePercent ?? 0))
      : payment === "debit" ? (debitFeePercent ?? 0)
      : 0;
  // Desconto manual (≠ cupom): % incide sobre os produtos; R$ é abatido direto.
  // Mantido como expressão inline (React Compiler — sem helper importado aqui).
  const manualDiscRaw = parseMoney(manualDiscInput);
  const manualDiscount = manualDiscType === "percent"
    ? Math.round(total * Math.min(100, manualDiscRaw) / 100 * 100) / 100
    : Math.min(manualDiscRaw, Math.max(0, total - discount));
  // Produtos líquidos (após cupom e desconto manual) + frete = base da taxa de cartão.
  const netProducts = Math.max(0, total - discount - manualDiscount);
  const cardBase = netProducts + deliveryFeeNum;
  // Valores monetários centrais como expressões inline (React Compiler) — os
  // helpers importados ficam só nas opções do <select> de parcelas.
  const cardFeeAmount = Math.round(cardBase * (cardPct / 100) * 100) / 100;
  const grandTotal = Math.round((cardBase + cardFeeAmount) * 100) / 100;
  // Entrada (sinal) quando a venda é parcial; recebido depende do status escolhido.
  const entryAmount = Math.min(parseMoney(entryInput), grandTotal);
  const receivedNow = payStatus === "paid" ? grandTotal : payStatus === "partial" ? entryAmount : 0;

  /* Clube Shark: estimativa de pontos para o cliente vinculado (exige CPF no
     cadastro dele). O crédito real é feito no momento de salvar a venda. */
  const customerCpfPresent = !!(customer?.cpf && customer.cpf.trim());
  const estimatedPoints = customer
    ? computeOrderPoints({ eligibleReais: total, currentPoints: customer.loyaltyPoints ?? 0, cpfPresent: customerCpfPresent })
    : 0;

  /* Totais do histórico: vendido (competência, exclui canceladas), recebido
     (caixa) e a receber (em aberto). Helpers usados em escopo isolado (useMemo). */
  const historyStats = useMemo(() => {
    let sold = 0, received = 0, pending = 0;
    let countPaid = 0, countPending = 0, countCancelled = 0;
    for (const sale of sales) {
      const st = saleStatus(sale);
      if (st === "cancelled") { countCancelled++; continue; }
      if (st === "paid") countPaid++; else countPending++;
      if (saleIsRevenue(sale)) sold += sale.total;
      received += saleReceivedAmount(sale);
      pending += saleOutstanding(sale);
    }
    const countValid = countPaid + countPending;
    const ticket = countValid > 0 ? sold / countValid : 0;
    return { sold, received, pending, countPaid, countPending, countCancelled, ticket };
  }, [sales]);

  /* ── Item management ──
     Cada linha é identificada por produto + variação (productId + variationId).
     Produtos com grade são adicionados por variação; simples, direto. */
  function lineStock(product: Product, variationId?: string): number {
    if (variationId) return product.variations?.find(v => v.id === variationId)?.stock ?? 0;
    return product.stock;
  }

  function addItem(product: Product, variation?: ProductVariation) {
    const vId = variation?.id ?? "";
    const stock = variation ? variation.stock : product.stock;
    const label = variation ? `${product.name} - ${variation.name}` : product.name;
    const current = items.find(i => i.productId === product.id && (i.variationId ?? "") === vId)?.quantity ?? 0;
    if (current >= stock) {
      toast.error(`Estoque insuficiente para "${label}" (disponível: ${stock} un).`);
      return;
    }
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id && (i.variationId ?? "") === vId);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id && (i.variationId ?? "") === vId
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
            : i
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        sku: variation?.sku ?? product.sku,
        category: product.category,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        // Custo congelado na venda (base do lucro). Só grava se houver custo.
        ...(product.costPrice ? { costPrice: product.costPrice } : {}),
        ...(variation ? { variationId: variation.id, variationName: variation.name } : {}),
      }];
    });
  }

  function changeQty(productId: string, variationId: string | undefined, delta: number) {
    const vId = variationId ?? "";
    if (delta > 0) {
      const product = products.find(p => p.id === productId);
      const item = items.find(i => i.productId === productId && (i.variationId ?? "") === vId);
      const stock = product ? lineStock(product, variationId) : 0;
      if (item && item.quantity >= stock) {
        const label = item.variationName ? `${item.productName} - ${item.variationName}` : item.productName;
        toast.error(`Estoque máximo de "${label}": ${stock} un.`);
        return;
      }
    }
    setItems(prev =>
      prev
        .map(i => {
          if (!(i.productId === productId && (i.variationId ?? "") === vId)) return i;
          const qty = Math.max(0, i.quantity + delta);
          return { ...i, quantity: qty, subtotal: qty * i.price };
        })
        .filter(i => i.quantity > 0)
    );
  }

  function removeItem(productId: string, variationId?: string) {
    const vId = variationId ?? "";
    setItems(prev => prev.filter(i => !(i.productId === productId && (i.variationId ?? "") === vId)));
  }

  /* ── Cupom de desconto ──
     Valida o código contra o carrinho (mesma engine do checkout). Quando o cupom
     tem limite por CPF, usa o CPF do cliente vinculado. */
  async function applyCoupon() {
    const code = normalizeCouponCode(couponInput);
    if (!code) return;
    if (!items.length) { setCouponError("Adicione itens antes de aplicar um cupom."); return; }
    setCouponError("");
    setCouponLoading(true);
    try {
      const coupon = await getCouponByCode(code);
      if (!coupon) {
        setCouponError("Cupom não encontrado.");
        setAppliedCoupon(null); setDiscount(0);
        return;
      }
      const couponItems = items.map(i => ({ categorySlug: i.category, lineTotal: i.subtotal }));
      const cpfDigits = (customer?.cpf ?? "").replace(/\D/g, "");
      const priorUses = coupon.usageLimitPerCpf != null && cpfDigits
        ? await countCouponUsesForCpf(coupon.id, cpfDigits)
        : 0;
      const result = evaluateCoupon(coupon, {
        items: couponItems,
        cpf: cpfDigits || undefined,
        priorUsesForCpf: priorUses,
      });
      if (!result.valid) {
        setCouponError(result.message ?? "Cupom inválido.");
        setAppliedCoupon(null); setDiscount(0);
        return;
      }
      setAppliedCoupon(coupon);
      setDiscount(result.discount);
      toast.success(`Cupom ${coupon.code} aplicado!`);
    } catch {
      setCouponError("Não foi possível validar o cupom. Tente novamente.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponInput("");
    setCouponError("");
  }

  /* ── Save sale ── */
  async function handleSave() {
    if (!items.length || !user) return;
    // Trava final: bloqueia a venda se algum item exceder o estoque atual.
    const over = items.find(i => {
      const p = products.find(pp => pp.id === i.productId);
      return !p || i.quantity > lineStock(p, i.variationId);
    });
    if (over) {
      const p = products.find(pp => pp.id === over.productId);
      const stock = p ? lineStock(p, over.variationId) : 0;
      const label = over.variationName ? `${over.productName} - ${over.variationName}` : over.productName;
      toast.error(`Estoque insuficiente para "${label}" (disponível: ${stock} un).`);
      return;
    }
    // Desconto manual exige motivo (rastreabilidade).
    if (manualDiscount > 0 && !manualDiscReason.trim()) {
      toast.error("Informe o motivo do desconto manual.");
      return;
    }
    // Venda pendente/parcial é uma dívida — precisa de cliente vinculado.
    if (payStatus !== "paid" && !customer) {
      toast.error("Vincule um cliente para registrar venda pendente ou parcial.");
      return;
    }
    if (payStatus === "partial" && !(entryAmount > 0)) {
      toast.error("Informe o valor da entrada (sinal) para venda parcial.");
      return;
    }
    // Resolve o vendedor responsável (admin pode atribuir a outro; vendedor é ele mesmo).
    const seller = sellers.find(s => s.uid === sellerId);
    const finalSellerId = isAdmin ? (seller?.uid ?? user.uid) : user.uid;
    const finalSellerName = isAdmin
      ? (seller?.displayName ?? user.displayName ?? "Vendedor")
      : (user.displayName ?? "Vendedor");
    setSaving(true);
    setSavedId(null);
    try {
      /* Pontos do Clube Shark: quando há cliente vinculado COM CPF, a venda pontua
         na conta dele (mesma engine do e-commerce) — vale também no presencial.
         A taxa vem do nível atual do cliente; o multiplicador "Pontos em Dobro"
         (2×) sai do produto ou da categoria. Sem cliente/CPF, não pontua. */
      let pointsEarned = 0;
      if (customer && customerCpfPresent) {
        const cats = await getCategories();
        const catDouble = new Map(cats.map(c => [c.slug, !!c.doublePoints]));
        pointsEarned = computeOrderPointsForItems({
          items: items.map(it => {
            const p = products.find(pp => pp.id === it.productId);
            const isDouble = !!p?.doublePoints || (!!p && (catDouble.get(p.category) ?? false));
            return { reais: it.subtotal, multiplier: isDouble ? 2 : 1 };
          }),
          currentPoints: customer.loyaltyPoints ?? 0,
          cpfPresent: true,
        });
      }

      const manualDiscountObj: SaleManualDiscount | undefined = manualDiscount > 0
        ? {
            amount: manualDiscount,
            type: manualDiscType,
            ...(manualDiscType === "percent" ? { percent: Math.min(100, manualDiscRaw) } : {}),
            reason: manualDiscReason.trim(),
            grantedBy: user.uid,
            grantedAt: new Date().toISOString(),
          }
        : undefined;

      const id = await createSale({
        sellerId: finalSellerId,
        sellerName: finalSellerName,
        items,
        subtotal: total,                 // produtos (base da comissão)
        total: grandTotal,               // produtos + frete + taxa do cartão − descontos
        channel,
        paymentMethod: payment,
        ...(deliveryFeeNum > 0 ? { deliveryFee: deliveryFeeNum } : {}),
        ...(cardFeeAmount > 0 ? { cardFee: cardFeeAmount, cardFeePercent: cardPct } : {}),
        ...(payment === "credit" && creditInstallments > 1 ? { installments: creditInstallments } : {}),
        ...(appliedCoupon && discount > 0 ? { couponCode: appliedCoupon.code, discount } : {}),
        ...(manualDiscountObj ? { manualDiscount: manualDiscountObj } : {}),
        ...(pointsEarned > 0 ? { pointsEarned } : {}),
        notes: notes.trim() || undefined,
        ...(customer ? { customerId: customer.uid, customerName: customer.displayName } : {}),
        ...(deliveryLater ? { deliveryLater: true } : {}),
        // Pagamento: status + valor recebido na criação (entrada/sinal ou total).
        paymentStatus: payStatus,
        amountReceived: receivedNow,
        ...(payStatus !== "paid" && dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
        createdBy: user.uid,
      });

      /* Registra o uso do cupom (auditoria + limite por CPF) — não bloqueia a venda. */
      if (appliedCoupon && discount > 0) {
        await recordCouponRedemption({
          couponId: appliedCoupon.id,
          code: appliedCoupon.code,
          cpf: (customer?.cpf ?? "").replace(/\D/g, ""),
          userId: customer?.uid ?? finalSellerId,
          orderId: id,
          discount,
        }).catch(err => console.error("Falha ao registrar uso do cupom:", err));
      }

      /* Credita os pontos na conta do cliente — SOMENTE quando a venda já nasce
         quitada. Em venda pendente/parcial os pontos são creditados ao quitar
         (registerSalePayment), espelhando o e-commerce. */
      if (payStatus === "paid" && customer && pointsEarned > 0) {
        await addLoyaltyPoints(
          customer.uid,
          pointsEarned,
          `Venda PDV #${id.slice(-6).toUpperCase()}`,
          "earned",
        ).catch(err => console.error("Falha ao creditar pontos:", err));
      }

      setSavedId(id.slice(-8).toUpperCase());
      const attributedToOther = finalSellerId !== user.uid;
      toast.success(
        attributedToOther
          ? `Venda registrada para ${finalSellerName}!`
          : payStatus === "paid"
            ? "Venda registrada com sucesso!"
            : payStatus === "partial"
              ? "Venda parcial registrada — saldo em Contas a Receber."
              : "Venda pendente registrada em Contas a Receber.",
      );
      if (payStatus === "paid" && customer && pointsEarned > 0) {
        toast.success(`+${pointsEarned.toLocaleString("pt-BR")} pontos creditados para ${customer.displayName}.`);
      }
      setItems([]);
      setNotes("");
      setPayment("cash");
      setChannel("in_store");
      setDeliveryFee("");
      setCreditInstallments(1);
      removeCoupon();
      setManualDiscType("fixed");
      setManualDiscInput("");
      setManualDiscReason("");
      setPayStatus("paid");
      setEntryInput("");
      setDueDate("");
      setCustomer(null);
      setCustomerQuery("");
      setDeliveryLater(false);
      await loadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[createSale]", err);
      toast.error(`Erro ao registrar venda: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  /* ── Entrega posterior: marcar como entregue ── */
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  async function handleMarkDelivered(saleId: string) {
    setDeliveringId(saleId);
    try {
      await markSaleDelivered(saleId);
      setSales(prev => prev.map(s =>
        s.id === saleId ? { ...s, delivered: true, deliveredAt: new Date().toISOString() } : s,
      ));
      toast.success("Venda marcada como entregue.");
    } catch {
      toast.error("Não foi possível atualizar a entrega.");
    } finally {
      setDeliveringId(null);
    }
  }

  /* ── Registrar recebimento de uma venda pendente/parcial ── */
  function openPayDialog(sale: Sale) {
    setPayTarget(sale);
    setPayAmount(saleOutstanding(sale).toFixed(2).replace(".", ","));
    setPayMethod(sale.paymentMethod);
  }
  async function handleRegisterPayment() {
    if (!payTarget || !user) return;
    const amount = parseMoney(payAmount);
    if (!(amount > 0)) { toast.error("Informe um valor de recebimento válido."); return; }
    setPaySaving(true);
    try {
      await registerSalePayment(payTarget.id, { amount, method: payMethod, receivedBy: user.uid });
      toast.success("Recebimento registrado.");
      setPayTarget(null);
      setPayAmount("");
      await loadHistory(startDate, endDate, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o recebimento.");
    } finally {
      setPaySaving(false);
    }
  }

  /* ── Cancelar venda (somente admin) — estorna estoque e pontos ── */
  async function handleCancelSale() {
    if (!cancelTarget || !user) return;
    if (!cancelReason.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    setCancelSaving(true);
    try {
      await cancelSale(cancelTarget.id, cancelReason.trim(), user.uid);
      toast.success("Venda cancelada — estoque estornado.");
      setCancelTarget(null);
      setCancelReason("");
      await loadHistory(startDate, endDate, true);
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar a venda.");
    } finally {
      setCancelSaving(false);
    }
  }

  /* ── Zerar dados de vendas ──
     Remove TODAS as vendas do PDV e os pedidos online, para iniciar a operação
     com a base limpa. Mantém produtos e estoque. Exige confirmação digitada. */
  async function handleReset() {
    setResetting(true);
    try {
      const { sales: s, orders: o } = await resetSalesData();
      toast.success(
        `Dados zerados: ${s} venda${s !== 1 ? "s" : ""} e ${o} pedido${o !== 1 ? "s" : ""} removido${o !== 1 ? "s" : ""}.`,
      );
      setResetOpen(false);
      setResetConfirm("");
      setSales([]);
      await loadHistory(startDate, endDate);
    } catch (err) {
      console.error("[resetSalesData]", err);
      toast.error("Não foi possível zerar os dados. Tente novamente.");
    } finally {
      setResetting(false);
    }
  }

  /* ── Export ── */
  function handleExport() {
    try {
      const label = startDate && endDate
        ? `vendas_${startDate}_${endDate}`
        : `vendas_${new Date().toISOString().slice(0, 10)}`;
      exportSalesCSV(sales, `${label}.csv`);
      toast.success(`${sales.length} venda${sales.length !== 1 ? "s" : ""} exportada${sales.length !== 1 ? "s" : ""}!`);
    } catch {
      toast.error("Erro ao gerar o arquivo CSV.");
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Vendas"
          subtitle="Registre vendas e exporte relatórios"
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[var(--color-border)] pb-0">
          {[
            { key: "new", label: "Nova Venda", icon: ShoppingCart },
            { key: "history", label: "Histórico", icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "new" | "history")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === key
                  ? "border-[var(--color-neon-blue)] text-[var(--color-neon-blue)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── NEW SALE TAB ── */}
        {tab === "new" && (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Product catalogue */}
            <div className="lg:col-span-3 space-y-4">
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                icon={<Search className="w-4 h-4" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              {loadingProducts ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 gap-2">
                    <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto encontrado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {filtered.map(p => {
                    const hasVars = (p.variations?.length ?? 0) > 0;
                    const thumb = (
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          : <Package className="w-4 h-4 text-[var(--color-text-muted)]" />
                        }
                      </div>
                    );

                    // Produto com grade: card com chips por variação (bipa ou clica).
                    if (hasVars) {
                      return (
                        <div key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
                          <div className="flex items-center gap-3 mb-2">
                            {thumb}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {formatCurrency(p.price)} · {p.stock} un. no total
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {p.variations!.map(v => {
                              const inCartV = items.find(i => i.productId === p.id && i.variationId === v.id);
                              const out = v.stock <= 0;
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => !out && addItem(p, v)}
                                  disabled={out}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    out
                                      ? "opacity-40 cursor-not-allowed border-[var(--color-border)] text-[var(--color-text-muted)]"
                                      : inCartV
                                      ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                      : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon-blue)]/50"
                                  }`}
                                >
                                  {v.name} <span className="opacity-70">({v.stock})</span>
                                  {inCartV && <span className="ml-1 font-bold">·{inCartV.quantity}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Produto simples: clique adiciona.
                    const inCart = items.find(i => i.productId === p.id && !i.variationId);
                    return (
                      <button
                        key={p.id}
                        onClick={() => p.stock > 0 && addItem(p)}
                        disabled={p.stock === 0}
                        className={`text-left rounded-xl border p-3 transition-all flex items-center gap-3 ${
                          p.stock === 0
                            ? "opacity-40 cursor-not-allowed border-[var(--color-border)]"
                            : inCart
                            ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-neon-blue)]/50 hover:bg-[var(--color-bg-overlay)]"
                        }`}
                      >
                        {thumb}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {formatCurrency(p.price)} · {p.stock === 0 ? "Sem estoque" : `${p.stock} un.`}
                          </p>
                        </div>
                        {inCart && (
                          <Badge variant="premium" className="text-xs shrink-0">{inCart.quantity}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart / sale summary */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="lg:sticky lg:top-28">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Venda Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Success banner */}
                  <AnimatePresence>
                    {savedId && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-sm text-emerald-400"
                      >
                        Venda <strong>#{savedId}</strong> registrada!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                      Selecione produtos ao lado para adicionar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map(item => (
                        <div
                          key={`${item.productId}:${item.variationId ?? ""}`}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {item.productName}
                              {item.variationName && <span className="text-[var(--color-neon-blue)]"> · {item.variationName}</span>}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(item.price)} × {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => changeQty(item.productId, item.variationId, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-bold text-[var(--color-text-primary)] w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => changeQty(item.productId, item.variationId, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeItem(item.productId, item.variationId)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-colors ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-[var(--color-neon-blue)] shrink-0 w-16 text-right">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Canal — onde a venda foi feita */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Onde foi a venda</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CHANNEL_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setChannel(value)}
                          title={desc}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                            channel === value
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                    {channel === "delivery" && (
                      <div className="mt-2">
                        <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Frete (R$)</label>
                        <Input
                          inputMode="decimal"
                          placeholder="Ex: 8,00 (opcional)"
                          icon={<Truck className="w-4 h-4" />}
                          value={deliveryFee}
                          onChange={e => setDeliveryFee(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Cliente vinculado (venda presencial) */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Cliente</label>
                    {customer ? (
                      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-neon-blue)]/40 bg-[var(--color-neon-blue-glow)] px-3 py-2">
                        <User className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{customer.displayName}</p>
                          {(customer.phone || customer.email) && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{customer.phone || customer.email}</p>
                          )}
                        </div>
                        <button
                          onClick={() => { setCustomer(null); setCustomerQuery(""); }}
                          className="w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          aria-label="Remover cliente"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {/* Clube Shark: pontuação vai para a conta do cliente vinculado */}
                    {customer && (
                      customerCpfPresent ? (
                        estimatedPoints > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
                            <Star className="w-3.5 h-3.5 shrink-0" />
                            <span><strong>{estimatedPoints.toLocaleString("pt-BR")} pontos</strong> serão creditados para {customer.displayName}.</span>
                          </div>
                        )
                      ) : (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                          <Star className="w-3.5 h-3.5 shrink-0" />
                          <span>Cliente sem CPF cadastrado — a venda não pontua no Clube Shark.</span>
                        </div>
                      )
                    )}

                    {!customer && (
                      <div className="relative">
                        <Input
                          placeholder="Buscar cliente por nome, telefone ou e-mail..."
                          icon={<Search className="w-4 h-4" />}
                          value={customerQuery}
                          onChange={e => setCustomerQuery(e.target.value)}
                        />
                        {customerQuery.trim() && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg overflow-hidden">
                            {customerMatches.length === 0 ? (
                              <p className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">Nenhum cliente encontrado.</p>
                            ) : (
                              customerMatches.map(c => (
                                <button
                                  key={c.uid}
                                  onClick={() => { setCustomer(c); setCustomerQuery(""); }}
                                  className="w-full text-left px-3 py-2 hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.displayName}</p>
                                  <p className="text-xs text-[var(--color-text-muted)] truncate">{c.phone || c.email}</p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Vendedor responsável — admin atribui a venda a um vendedor */}
                  {isAdmin && (
                    <div>
                      <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Vendedor</label>
                      <select
                        value={sellerId}
                        onChange={e => setSellerId(e.target.value)}
                        className={inputCls}
                      >
                        {user && !sellers.some(s => s.uid === user.uid) && (
                          <option value={user.uid}>{user.displayName ?? "Eu"} (você)</option>
                        )}
                        {sellers.map(s => (
                          <option key={s.uid} value={s.uid}>
                            {s.displayName}{s.uid === user?.uid ? " (você)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Entrega posterior */}
                  <button
                    type="button"
                    onClick={() => setDeliveryLater(v => !v)}
                    className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${
                      deliveryLater
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] hover:border-amber-500/30"
                    }`}
                  >
                    <Truck className={`w-4 h-4 shrink-0 ${deliveryLater ? "text-amber-400" : "text-[var(--color-text-muted)]"}`} />
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium ${deliveryLater ? "text-amber-400" : "text-[var(--color-text-secondary)]"}`}>Entrega posterior</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Cliente não vai retirar o produto agora</p>
                    </div>
                    <span className={`w-9 h-5 rounded-full shrink-0 transition-colors relative ${deliveryLater ? "bg-amber-500" : "bg-[var(--color-border)]"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${deliveryLater ? "left-[1.125rem]" : "left-0.5"}`} />
                    </span>
                  </button>

                  {/* Payment method */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Pagamento</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAYMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setPayment(opt.value)}
                          className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                            payment === opt.value
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Parcelamento no crédito — usa a tabela cadastrada em Pagamentos */}
                    {payment === "credit" && (
                      <div className="mt-2">
                        <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Parcelas (na maquininha)</label>
                        <select
                          value={creditInstallments}
                          onChange={e => setCreditInstallments(Number(e.target.value))}
                          className={inputCls}
                        >
                          <option value={1}>
                            À vista (direto) — {formatCurrency(cardTotalFor(cardBase, creditFeePercent ?? 0, 0))}
                          </option>
                          {installmentOptions.map(({ installments: n, feePercent }) => (
                            <option key={n} value={n}>
                              {n}x de {formatCurrency(cardTotalFor(cardBase, feePercent, 0) / n)}
                              {feePercent !== 0 ? ` (taxa ${formatFeePercent(feePercent)})` : ""}
                            </option>
                          ))}
                        </select>
                        {installmentOptions.length === 0 && (
                          <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">
                            Nenhuma taxa de parcelamento cadastrada. Configure em Admin → Pagamentos.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status do pagamento (fiado / parcial / pago) */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Recebimento</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { v: "paid", label: "Pago", icon: CheckCircle },
                        { v: "partial", label: "Parcial", icon: Wallet },
                        { v: "pending", label: "Pendente", icon: Clock },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setPayStatus(opt.v)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                            payStatus === opt.v
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          <opt.icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {payStatus !== "paid" && (
                      <div className="mt-2 space-y-2">
                        {payStatus === "partial" && (
                          <div>
                            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Entrada (sinal) — R$</label>
                            <input
                              value={entryInput}
                              onChange={e => setEntryInput(e.target.value)}
                              inputMode="decimal"
                              placeholder="0,00"
                              className={inputCls}
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Vencimento (opcional)</label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <p className="flex items-start gap-1.5 text-[11px] text-amber-400/90">
                          <CircleDollarSign className="w-3.5 h-3.5 shrink-0 mt-px" />
                          {payStatus === "partial"
                            ? "O saldo restante fica em Contas a Receber. Vincule o cliente."
                            : "Venda fiada: o valor total fica em Contas a Receber. Vincule o cliente."}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Desconto manual (≠ cupom) — exige motivo */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Desconto manual</label>
                    <div className="flex gap-1.5">
                      <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden shrink-0">
                        {(["fixed", "percent"] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setManualDiscType(t)}
                            className={`px-3 text-sm font-medium transition-all ${
                              manualDiscType === t
                                ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {t === "fixed" ? "R$" : "%"}
                          </button>
                        ))}
                      </div>
                      <input
                        value={manualDiscInput}
                        onChange={e => setManualDiscInput(e.target.value)}
                        inputMode="decimal"
                        placeholder={manualDiscType === "fixed" ? "0,00" : "0"}
                        className={inputCls}
                      />
                    </div>
                    {manualDiscount > 0 && (
                      <input
                        value={manualDiscReason}
                        onChange={e => setManualDiscReason(e.target.value)}
                        placeholder="Motivo (obrigatório): amigo, fidelizado, defeito..."
                        className={inputCls + " mt-1.5"}
                      />
                    )}
                  </div>

                  {/* Cupom de desconto */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Cupom</label>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                        <span className="flex items-center gap-2 min-w-0 text-sm font-medium text-emerald-400 truncate">
                          <Ticket className="w-4 h-4 shrink-0" />
                          {appliedCoupon.code} · −{formatCurrency(discount)}
                        </span>
                        <button onClick={removeCoupon} className="text-xs text-[var(--color-text-muted)] hover:text-red-400 shrink-0">
                          Remover
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                            <input
                              value={couponInput}
                              onChange={e => { setCouponInput(normalizeCouponCode(e.target.value)); setCouponError(""); }}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                              placeholder="Código do cupom"
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] pl-9 pr-3 py-2.5 text-sm uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:normal-case focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
                            />
                          </div>
                          <Button variant="secondary" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()}>
                            {couponLoading
                              ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              : "Aplicar"}
                          </Button>
                        </div>
                        {couponError && <p className="text-xs text-red-400 mt-1.5">{couponError}</p>}
                      </>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Observações</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Opcional..."
                      className={inputCls + " resize-none"}
                    />
                  </div>

                  {/* Total + button */}
                  <div className="border-t border-[var(--color-border)] pt-3 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-muted)]">Subtotal (produtos)</span>
                        <span className="text-[var(--color-text-secondary)]">{formatCurrency(total)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-emerald-400">Desconto{appliedCoupon ? ` · ${appliedCoupon.code}` : ""}</span>
                          <span className="text-emerald-400">−{formatCurrency(discount)}</span>
                        </div>
                      )}
                      {manualDiscount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-emerald-400">Desconto manual{manualDiscType === "percent" ? ` · ${Math.min(100, manualDiscRaw)}%` : ""}</span>
                          <span className="text-emerald-400">−{formatCurrency(manualDiscount)}</span>
                        </div>
                      )}
                      {deliveryFeeNum > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-muted)]">Frete</span>
                          <span className="text-[var(--color-text-secondary)]">{formatCurrency(deliveryFeeNum)}</span>
                        </div>
                      )}
                      {cardFeeAmount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-muted)]">
                            {payment === "credit" && creditInstallments > 1
                              ? `Taxa de parcelamento (${creditInstallments}x)`
                              : "Taxa do cartão"}
                          </span>
                          <span className="text-[var(--color-text-secondary)]">+{formatCurrency(cardFeeAmount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2.5">
                      <span className="text-sm text-[var(--color-text-muted)]">Total</span>
                      <span className="text-2xl font-black text-[var(--color-neon-blue)]">{formatCurrency(grandTotal)}</span>
                    </div>
                    {payStatus !== "paid" && (
                      <div className="space-y-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--color-text-muted)]">Recebido agora</span>
                          <span className="text-[var(--color-text-secondary)]">{formatCurrency(receivedNow)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="text-amber-400">A receber</span>
                          <span className="text-amber-400">{formatCurrency(grandTotal - receivedNow)}</span>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="premium"
                      className="w-full"
                      disabled={items.length === 0 || saving}
                      onClick={handleSave}
                    >
                      {saving
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><Receipt className="w-4 h-4" /> Registrar Venda</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">De</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Até</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <Button variant="secondary" onClick={() => loadHistory(startDate, endDate)}>
                  Filtrar
                </Button>
                <Button
                  variant="premium"
                  disabled={sales.length === 0}
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4" /> Exportar CSV
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            {!loadingHistory && sales.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(historyStats.sold)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Total vendido</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Ticket médio {formatCurrency(historyStats.ticket)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-neon-blue-glow)] flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-[var(--color-neon-blue)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(historyStats.received)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Recebido (caixa)</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CircleDollarSign className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(historyStats.pending)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">A receber</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--color-text-primary)]">{sales.length}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {historyStats.countPaid} pagas · {historyStats.countPending} pend. · {historyStats.countCancelled} canc.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sales list */}
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
              </div>
            ) : sales.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-14 gap-2">
                  <History className="w-8 h-8 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">Nenhuma venda no período selecionado.</p>
                </CardContent>
              </Card>
            ) : (
              <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {sales.map((sale, i) => {
                  const date = toDate(sale.createdAt);
                  const isOpen = expanded === sale.id;
                  return (
                    <motion.div
                      key={sale.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                    >
                      <Card>
                        <CardContent className="p-0">
                          <button
                            onClick={() => setExpanded(isOpen ? null : sale.id)}
                            className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--color-bg-hover)] transition-colors rounded-xl"
                          >
                            <div className="text-center shrink-0 w-14">
                              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              </p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                  #{sale.id.slice(-8).toUpperCase()}
                                </span>
                                <span className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                  {sale.sellerName}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                {sale.items.length} {sale.items.length === 1 ? "item" : "itens"} · {SALE_CHANNEL_LABELS[sale.channel ?? "in_store"]} · {PAYMENT_LABELS[sale.paymentMethod]}
                                {(sale.installments ?? 1) > 1 && ` ${sale.installments}x`}
                                {sale.customerName && ` · ${sale.customerName}`}
                                {(() => {
                                  const c = saleCommission(sale);
                                  return c ? <span className="text-emerald-400/80"> · Comissão {formatCurrency(c.amount)} ({c.rate}%)</span> : null;
                                })()}
                                {sale.notes && ` · ${sale.notes}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {saleStatus(sale) !== "paid" && (
                                <Badge variant={SALE_PAYMENT_STATUS_BADGE[saleStatus(sale)]} className="text-[10px] hidden sm:inline-flex">
                                  {SALE_PAYMENT_STATUS_LABELS[saleStatus(sale)]}
                                </Badge>
                              )}
                              {sale.deliveryLater && (
                                <Badge variant={sale.delivered ? "success" : "warning"} className="text-[10px] hidden sm:inline-flex">
                                  {sale.delivered ? "Entregue" : "Entrega pendente"}
                                </Badge>
                              )}
                              <span className={`font-bold ${saleStatus(sale) === "cancelled" ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-neon-blue)]"}`}>{formatCurrency(sale.total)}</span>
                              {isOpen
                                ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                                : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                              }
                            </div>
                          </button>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-1.5">
                                  {(sale.customerName || sale.deliveryLater) && (
                                    <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 mb-1 border-b border-[var(--color-border)]/60">
                                      {sale.customerName && (
                                        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                          <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                          Cliente: <strong className="text-[var(--color-text-primary)]">{sale.customerName}</strong>
                                        </span>
                                      )}
                                      {sale.deliveryLater && !sale.delivered && (
                                        <button
                                          onClick={() => handleMarkDelivered(sale.id)}
                                          disabled={deliveringId === sale.id}
                                          className="flex items-center gap-1 px-2.5 h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 ml-auto"
                                        >
                                          {deliveringId === sale.id
                                            ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                            : <><CheckCircle className="w-3 h-3" /> Marcar entregue</>}
                                        </button>
                                      )}
                                      {sale.deliveryLater && sale.delivered && (
                                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 ml-auto">
                                          <CheckCircle className="w-3.5 h-3.5" /> Entregue
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {sale.items.map(item => (
                                    <div
                                      key={item.productId}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-[var(--color-text-secondary)]">
                                        {item.productName}
                                        {item.variationName && <span className="text-[var(--color-neon-blue)] ml-1">· {item.variationName}</span>}
                                        {item.sku && <span className="text-[var(--color-text-muted)] ml-1">({item.sku})</span>}
                                      </span>
                                      <span className="text-[var(--color-text-muted)]">
                                        {item.quantity} × {formatCurrency(item.price)} = {" "}
                                        <span className="text-[var(--color-text-primary)] font-semibold">{formatCurrency(item.subtotal)}</span>
                                      </span>
                                    </div>
                                  ))}

                                  {/* Detalhamento financeiro da venda */}
                                  <div className="pt-1.5 mt-1 border-t border-[var(--color-border)]/60 space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-[var(--color-text-muted)]">Subtotal (produtos)</span>
                                      <span className="text-[var(--color-text-secondary)]">{formatCurrency(sale.subtotal ?? sale.total)}</span>
                                    </div>
                                    {!!sale.discount && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-emerald-400">Desconto{sale.couponCode ? ` · ${sale.couponCode}` : ""}</span>
                                        <span className="text-emerald-400">−{formatCurrency(sale.discount)}</span>
                                      </div>
                                    )}
                                    {!!sale.manualDiscount && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-emerald-400">
                                          Desconto manual
                                          {sale.manualDiscount.type === "percent" && sale.manualDiscount.percent != null ? ` · ${sale.manualDiscount.percent}%` : ""}
                                          <span className="text-[var(--color-text-muted)]"> · {sale.manualDiscount.reason}</span>
                                        </span>
                                        <span className="text-emerald-400">−{formatCurrency(sale.manualDiscount.amount)}</span>
                                      </div>
                                    )}
                                    {!!sale.deliveryFee && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--color-text-muted)]">Frete</span>
                                        <span className="text-[var(--color-text-secondary)]">{formatCurrency(sale.deliveryFee)}</span>
                                      </div>
                                    )}
                                    {!!sale.cardFee && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--color-text-muted)]">
                                          {(sale.installments ?? 1) > 1
                                            ? `Taxa de parcelamento (${sale.installments}x)`
                                            : "Taxa do cartão"}
                                          {sale.cardFeePercent ? ` · ${formatFeePercent(sale.cardFeePercent)}` : ""}
                                        </span>
                                        <span className="text-[var(--color-text-secondary)]">+{formatCurrency(sale.cardFee)}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm font-semibold">
                                      <span className="text-[var(--color-text-secondary)]">Total cobrado</span>
                                      <span className="text-[var(--color-neon-blue)]">{formatCurrency(sale.total)}</span>
                                    </div>
                                    {!!sale.pointsEarned && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
                                          <Star className="w-3.5 h-3.5" />
                                          {sale.pointsReversed
                                            ? "Pontos estornados"
                                            : sale.pointsAwarded === false
                                              ? "Pontos a creditar (ao quitar)"
                                              : "Pontos creditados"}
                                        </span>
                                        <span className={`font-semibold ${sale.pointsReversed ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-warning)]"}`}>+{sale.pointsEarned.toLocaleString("pt-BR")}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Pagamento (fiado / parcial) + ações */}
                                  {(saleStatus(sale) !== "paid" || (sale.payments && sale.payments.length > 1)) && (
                                    <div className="pt-1.5 mt-1 border-t border-[var(--color-border)]/60 space-y-1">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                                          <Wallet className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" /> Status
                                        </span>
                                        <Badge variant={SALE_PAYMENT_STATUS_BADGE[saleStatus(sale)]} className="text-[10px]">
                                          {SALE_PAYMENT_STATUS_LABELS[saleStatus(sale)]}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-[var(--color-text-muted)]">Recebido</span>
                                        <span className="text-[var(--color-text-secondary)]">{formatCurrency(saleReceivedAmount(sale))}</span>
                                      </div>
                                      {saleOutstanding(sale) > 0 && (
                                        <div className="flex items-center justify-between text-sm font-semibold">
                                          <span className="text-amber-400">A receber</span>
                                          <span className="text-amber-400">{formatCurrency(saleOutstanding(sale))}</span>
                                        </div>
                                      )}
                                      {sale.dueDate && saleStatus(sale) !== "cancelled" && (
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                                            <CalendarClock className="w-3.5 h-3.5" /> Vencimento
                                          </span>
                                          <span className="text-[var(--color-text-secondary)]">{toDate(sale.dueDate).toLocaleDateString("pt-BR")}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {saleStatus(sale) === "cancelled" && (
                                    <div className="flex items-start gap-1.5 text-xs text-red-400 pt-1.5 mt-1 border-t border-[var(--color-border)]/60">
                                      <Ban className="w-3.5 h-3.5 shrink-0 mt-px" />
                                      Cancelada{sale.cancelReason ? ` · ${sale.cancelReason}` : ""}
                                    </div>
                                  )}

                                  {/* Ações: receber (vendedor) / cancelar (admin) */}
                                  {saleStatus(sale) !== "cancelled" && (saleOutstanding(sale) > 0 || isAdmin) && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      {saleOutstanding(sale) > 0 && (
                                        <button
                                          onClick={() => openPayDialog(sale)}
                                          className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--color-neon-blue)]/40 bg-[var(--color-neon-blue-glow)] text-xs font-medium text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)]/20 transition-colors"
                                        >
                                          <CircleDollarSign className="w-3.5 h-3.5" /> Registrar recebimento
                                        </button>
                                      )}
                                      {isAdmin && (
                                        <button
                                          onClick={() => { setCancelTarget(sale); setCancelReason(""); }}
                                          className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                                        >
                                          <Ban className="w-3.5 h-3.5" /> Cancelar venda
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Comissão do vendedor sobre esta venda (taxa atual do perfil) */}
                                  {(() => {
                                    const rate = sellerById.get(sale.sellerId)?.commissionRate;
                                    const c = saleCommission(sale); // null se não quitada ou sem taxa
                                    const pendingCommission = !c && rate != null && rate > 0 && saleStatus(sale) !== "cancelled";
                                    return (
                                      <div className="flex items-center justify-between text-sm pt-1.5 mt-1 border-t border-[var(--color-border)]/60">
                                        <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                                          <Percent className="w-3.5 h-3.5 text-emerald-400" />
                                          Comissão {sale.sellerName}
                                          {(c || pendingCommission) && <span className="text-[var(--color-text-muted)]">({rate}%)</span>}
                                        </span>
                                        {c ? (
                                          <span className="font-semibold text-emerald-400">{formatCurrency(c.amount)}</span>
                                        ) : pendingCommission ? (
                                          <span className="text-xs text-amber-400">aguardando quitação</span>
                                        ) : (
                                          <span className="text-xs text-[var(--color-text-muted)]">sem comissão definida</span>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Auditoria / rastreabilidade da venda */}
                                  {sale.audit && sale.audit.length > 0 && (
                                    <details className="pt-1.5 mt-1 border-t border-[var(--color-border)]/60">
                                      <summary className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] cursor-pointer select-none">
                                        <History className="w-3.5 h-3.5" /> Auditoria ({sale.audit.length})
                                      </summary>
                                      <div className="mt-2 space-y-1.5 pl-1">
                                        {sale.audit.map((ev, idx) => {
                                          const who = sellerById.get(ev.by)?.displayName ?? (ev.by === "system" ? "Sistema" : ev.by.slice(-6).toUpperCase());
                                          const when = toDate(ev.at);
                                          const label =
                                            ev.type === "created" ? "Venda registrada"
                                            : ev.type === "payment" ? (ev.note ? ev.note : `Recebimento${ev.amount != null ? ` de ${formatCurrency(ev.amount)}` : ""}`)
                                            : ev.type === "status_change" ? `Status: ${SALE_PAYMENT_STATUS_LABELS[ev.from ?? "paid"]} → ${SALE_PAYMENT_STATUS_LABELS[ev.to ?? "paid"]}`
                                            : ev.type === "cancelled" ? `Cancelada${ev.note ? ` · ${ev.note}` : ""}`
                                            : ev.type === "stock_reversed" ? "Estoque estornado"
                                            : ev.type === "points_reversed" ? `Pontos revertidos${ev.amount != null ? ` (${ev.amount})` : ""}`
                                            : ev.type;
                                          return (
                                            <div key={idx} className="flex items-start gap-2 text-[11px]">
                                              <span className="text-[var(--color-text-muted)] shrink-0 w-24 tabular-nums">
                                                {when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                              <span className="text-[var(--color-text-secondary)] flex-1">
                                                {label} <span className="text-[var(--color-text-muted)]">· {who}</span>
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Zona de perigo — zerar dados de vendas (apenas admin) */}
            {isAdmin && (
              <Card className="border-red-500/30">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    Zerar dados de vendas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                    Remove <strong>todas as vendas do PDV</strong> e <strong>todos os pedidos online</strong> para
                    iniciar a operação com a base limpa.
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    Os produtos e o estoque atual são mantidos. As métricas do dashboard zeram automaticamente.
                    Esta ação não pode ser desfeita.
                  </p>
                  <Button
                    variant="default"
                    className="bg-red-500 hover:bg-red-600 text-white border-0"
                    onClick={() => { setResetConfirm(""); setResetOpen(true); }}
                  >
                    <Trash2 className="w-4 h-4" /> Zerar dados de vendas
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Mini calculadora flutuante — nas duas abas (mimo para o balcão) */}
      <MiniCalculator />

      {/* Confirmação do reset — exige digitar ZERAR */}
      <Dialog open={resetOpen} onOpenChange={(v) => { if (!resetting) { setResetOpen(v); if (!v) setResetConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Zerar dados de vendas
            </DialogTitle>
            <DialogDescription>
              Isso vai apagar <strong>permanentemente</strong> todas as vendas do PDV e todos os pedidos online.
              Produtos e estoque não são afetados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
              Digite <span className="font-mono font-bold text-red-400">ZERAR</span> para confirmar
            </label>
            <input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="ZERAR"
              className={inputCls}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancelar
            </Button>
            <Button
              variant="default"
              className="bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={handleReset}
              disabled={resetting || resetConfirm.trim().toUpperCase() !== "ZERAR"}
            >
              {resetting
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Zerar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar recebimento de venda pendente/parcial */}
      <Dialog open={!!payTarget} onOpenChange={(v) => { if (!paySaving && !v) { setPayTarget(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-neon-blue)]">
              <CircleDollarSign className="w-5 h-5" /> Registrar recebimento
            </DialogTitle>
            <DialogDescription>
              {payTarget && (
                <>Venda #{payTarget.id.slice(-8).toUpperCase()}{payTarget.customerName ? ` · ${payTarget.customerName}` : ""}.
                Em aberto: <strong className="text-amber-400">{formatCurrency(saleOutstanding(payTarget))}</strong>.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Valor recebido — R$</label>
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Forma</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPayMethod(opt.value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                      payMethod === opt.value
                        ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setPayTarget(null); setPayAmount(""); }} disabled={paySaving}>
              Cancelar
            </Button>
            <Button variant="premium" onClick={handleRegisterPayment} disabled={paySaving || !(parseMoney(payAmount) > 0)}>
              {paySaving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar venda (admin) — estorna estoque e pontos */}
      <Dialog open={!!cancelTarget} onOpenChange={(v) => { if (!cancelSaving && !v) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" /> Cancelar venda
            </DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>Venda #{cancelTarget.id.slice(-8).toUpperCase()} ({formatCurrency(cancelTarget.total)}).
                O <strong>estoque será estornado</strong> e os pontos creditados serão revertidos.
                {saleReceivedAmount(cancelTarget) > 0 && (
                  <> Havia <strong className="text-amber-400">{formatCurrency(saleReceivedAmount(cancelTarget))}</strong> recebido — registre a devolução manualmente, se houver.</>
                )}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Motivo do cancelamento</label>
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: desistência do cliente, erro de lançamento..."
              className={inputCls}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelReason(""); }} disabled={cancelSaving}>
              Voltar
            </Button>
            <Button
              variant="default"
              className="bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={handleCancelSale}
              disabled={cancelSaving || !cancelReason.trim()}
            >
              {cancelSaving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Cancelar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
