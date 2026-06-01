"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin, ChevronRight, Package, CheckCircle,
  ArrowLeft, Phone, Truck, ShoppingBag, Receipt,
  Loader2, QrCode, Banknote, Plus, Star,
  Copy, Check, User, LogIn, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { useSitePayment } from "@/stores/siteSettingsStore";
import { toast } from "@/stores/toastStore";
import { createOrder, confirmWhatsappOrder, updateOrderStatus, updatePaymentStatus } from "@/lib/firebase/orders";
import { updateUserProfile } from "@/lib/firebase/users";
import { manualGateway } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import type { Address, PaymentMethod } from "@/types";

/* ── CEP lookup ──────────────────────────────────────────── */
async function fetchCep(zip: string) {
  const clean = zip.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data as { logradouro: string; bairro: string; localidade: string; uf: string };
  } catch {
    return null;
  }
}

function maskCep(v: string) {
  return v.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}
function maskPhone(v: string) {
  return v.replace(/\D/g, "").replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3").slice(0, 15);
}

/* ── Store contact ───────────────────────────────────────── */
const STORE_WHATSAPP = "5583999020606"; // número oficial da loja (somente dígitos, com DDI)

/* ── Payment options ─────────────────────────────────────── */
const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "pix_manual",  label: "PIX",          desc: "Pague na hora e envie o comprovante", icon: QrCode        },
  { value: "on_delivery", label: "Na Entrega",   desc: "Pague ao motoboy no recebimento",     icon: Banknote      },
  { value: "whatsapp",    label: "Via WhatsApp", desc: "Combine com a nossa equipe",          icon: MessageCircle },
];

/* Monta o link do WhatsApp com o resumo do pedido. */
function buildWaLink(orderId: string, items: { name: string; quantity: number; price: number }[], total: number) {
  const lines = [
    "Olá! Acabei de fazer um pedido na Shark Smokehouse 🦈",
    `Pedido #${orderId.slice(-8).toUpperCase()}`,
    "",
    ...items.map((i) => `• ${i.quantity}x ${i.name} — ${formatCurrency(i.price * i.quantity)}`),
    "",
    `Total: ${formatCurrency(total)}`,
    "Gostaria de combinar o pagamento. 🙏",
  ];
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/* Link do WhatsApp para o cliente enviar o comprovante do PIX. */
function buildProofLink(orderId: string, total: number) {
  const msg = [
    `Olá! Segue o comprovante do PIX do pedido #${orderId.slice(-8).toUpperCase()}.`,
    `Valor: ${formatCurrency(total)}`,
  ].join("\n");
  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

/* ── Success screen ──────────────────────────────────────── */
function SuccessScreen({ orderId, payment, waLink, total }: { orderId: string; payment: PaymentMethod; waLink: string; total: number }) {
  const [copied, setCopied] = useState(false);
  const [confirmState, setConfirmState] = useState<"idle" | "saving" | "confirmed" | "cancelled">("idle");
  const { pixKey, pixName, pixQrPayload } = useSitePayment();

  const copy = async () => {
    await navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Cliente responde se efetuou ou não a compra combinada pelo WhatsApp. */
  const handlePurchaseAnswer = async (purchased: boolean) => {
    setConfirmState("saving");
    try {
      if (purchased) {
        await confirmWhatsappOrder(orderId);
        setConfirmState("confirmed");
      } else {
        await updateOrderStatus(orderId, "cancelled", "Cliente não concluiu a compra pelo WhatsApp");
        await updatePaymentStatus(orderId, "cancelled", { note: "Compra não concluída pelo cliente (WhatsApp)" });
        setConfirmState("cancelled");
      }
    } catch (err) {
      console.error("[checkout] confirm whatsapp", err);
      toast.error("Não foi possível registrar sua resposta. Tente novamente.");
      setConfirmState("idle");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center"
    >
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-[var(--color-success)]/15 border border-[var(--color-success)]/30 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-10 h-10 text-[var(--color-success)]" />
        </motion.div>

        <h1 className="text-2xl font-black text-[var(--color-text-primary)] mb-2">Pedido confirmado!</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          Seu pedido foi recebido e está sendo processado.
        </p>
        <p className="text-xs font-mono text-[var(--color-neon-blue)] mb-8">
          #{orderId.slice(-8).toUpperCase()}
        </p>

        {payment === "whatsapp" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-5 mb-6 text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-sm font-bold text-[var(--color-success)]">Combine o pagamento</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Fale com a nossa equipe pelo WhatsApp para combinar o pagamento e a entrega do seu pedido.
            </p>
            <Button variant="premium" className="w-full" asChild>
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Falar com a equipe
              </a>
            </Button>

            {/* Confirmação: o cliente efetuou a compra? */}
            <Separator className="my-4" />
            {confirmState === "confirmed" ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
                <CheckCircle className="w-4 h-4" />
                Compra confirmada! Seu pedido está registrado.
              </div>
            ) : confirmState === "cancelled" ? (
              <div className="text-sm text-[var(--color-text-muted)]">
                Tudo bem, o pedido foi cancelado. Quando quiser, é só refazer. 🙂
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">
                  A compra foi efetuada pelo WhatsApp?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="premium"
                    className="w-full"
                    disabled={confirmState === "saving"}
                    onClick={() => handlePurchaseAnswer(true)}
                  >
                    {confirmState === "saving"
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Check className="w-4 h-4" /> Sim, concluí</>}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={confirmState === "saving"}
                    onClick={() => handlePurchaseAnswer(false)}
                  >
                    Não concluí
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {payment === "pix_manual" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]/20 p-5 mb-6 text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-4 h-4 text-[var(--color-neon-blue)]" />
              <span className="text-sm font-bold text-[var(--color-neon-blue)]">Pague via PIX</span>
            </div>

            {/* QR Code (BR Code) — quando o admin cadastrou o payload copia e cola */}
            {pixQrPayload && (
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-xl bg-white">
                  <QRCodeSVG value={pixQrPayload} size={168} marginSize={0} />
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Chave PIX{pixName ? ` — ${pixName}` : ""}:
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
              <span className="flex-1 text-sm font-mono text-[var(--color-text-primary)] break-all">{pixKey}</span>
              <button
                onClick={copy}
                className="shrink-0 p-1.5 rounded-lg bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)] hover:text-[var(--color-bg-base)] transition-all"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied
                    ? <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-3.5 h-3.5" /></motion.span>
                    : <motion.span key="u" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-3.5 h-3.5" /></motion.span>
                  }
                </AnimatePresence>
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3 mb-3">
              Após o pagamento, envie o comprovante pelo WhatsApp para liberarmos seu pedido.
            </p>
            <Button variant="premium" className="w-full" asChild>
              <a href={buildProofLink(orderId, total)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Enviar comprovante no WhatsApp
              </a>
            </Button>
          </motion.div>
        )}

        {payment === "on_delivery" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-5 mb-6 text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm font-bold text-[var(--color-text-primary)]">Pagamento na entrega</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Você pagará <strong className="text-[var(--color-text-secondary)]">{formatCurrency(total)}</strong> ao
              motoboy no momento do recebimento. Tenha o valor (ou a maquininha) à mão. 🛵
            </p>
          </motion.div>
        )}

        <div className="flex flex-col gap-3">
          <Button variant="premium" asChild>
            <Link href="/orders">
              <Receipt className="w-4 h-4" />
              Acompanhar Pedido
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/catalog">Continuar Comprando</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main checkout ───────────────────────────────────────── */
export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const cartStore = useCartStore();
  const { items, subtotal, deliveryFee, total, clearCart, closeCart } = cartStore;
  const { pixKey, pixName } = useSitePayment();

  /* form state */
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("pix_manual");
  const [notes, setNotes] = useState("");

  /* ui state */
  const [cepLoading, setCepLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [waLink, setWaLink] = useState("");

  const savedAddresses = user?.addresses ?? [];
  const pointsToEarn = items.reduce((acc, i) => acc + (i.pointsEarned ?? 0) * i.quantity, 0);

  /* fill form from saved address */
  const applySaved = useCallback((addr: Address) => {
    setSelectedSavedId(addr.id);
    setZip(addr.zipCode);
    setStreet(addr.street);
    setNumber(addr.number);
    setComplement(addr.complement ?? "");
    setNeighborhood(addr.neighborhood);
    setCity(addr.city);
    setState(addr.state);
  }, []);

  /* auto-select default address */
  useEffect(() => {
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def && !selectedSavedId) applySaved(def);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /* CEP lookup */
  const handleCep = useCallback(async (raw: string) => {
    const masked = maskCep(raw);
    setZip(masked);
    setSelectedSavedId(null);
    const clean = masked.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    const data = await fetchCep(clean);
    if (data) {
      setStreet(data.logradouro);
      setNeighborhood(data.bairro);
      setCity(data.localidade);
      setState(data.uf);
    }
    setCepLoading(false);
  }, []);

  /* redirect if empty */
  useEffect(() => {
    if (items.length === 0 && !orderId) router.replace("/catalog");
  }, [items, orderId, router]);

  if (!user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-7 h-7 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Entre para continuar</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Você precisa estar logado para finalizar seu pedido.</p>
          <Button variant="premium" asChild>
            <Link href="/login?redirect=/checkout">
              Entrar <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (orderId) {
    return <SuccessScreen orderId={orderId} payment={payment} waLink={waLink} total={total} />;
  }

  const canSubmit =
    street.trim() && number.trim() && neighborhood.trim() && city.trim() && state.trim() && zip.trim() &&
    (phone.trim() || user.phone);

  async function handlePlaceOrder() {
    if (!canSubmit || !user) return;
    setPlacing(true);
    try {
      const address: Address = {
        id: selectedSavedId ?? `addr_${Date.now()}`,
        label: "Entrega",
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zip.trim(),
      };

      const paymentInfo = manualGateway.createPayment({
        method: payment,
        amount: total,
        pixKey,
        pixName,
      });

      const id = await createOrder({
        customerId: user.uid,
        customerName: user.displayName ?? "Cliente",
        customerPhone: phone.trim() || user.phone || "",
        items,
        subtotal,
        deliveryFee,
        total,
        status: "received",
        payment: paymentInfo,
        paymentMethod: payment,            // espelho legado
        paymentStatus: paymentInfo.status, // espelho legado
        deliveryAddress: address,
        notes: notes.trim() || undefined,
        statusHistory: [{ status: "received", timestamp: new Date().toISOString() }],
        pointsEarned: pointsToEarn,
        ...(payment === "whatsapp" ? { awaitingConfirmation: true } : {}),
      });

      /* save address to profile if requested */
      if (saveAddress && !selectedSavedId) {
        const existing = user.addresses ?? [];
        const newAddr = { ...address, id: `addr_${Date.now()}`, label: "Casa", isDefault: existing.length === 0 };
        await updateUserProfile(user.uid, { addresses: [...existing, newAddr] });
      }
      /* save phone if changed */
      if (phone.trim() && phone.trim() !== user.phone) {
        await updateUserProfile(user.uid, { phone: phone.trim() });
      }

      /* monta o link do WhatsApp antes de limpar o carrinho */
      setWaLink(buildWaLink(id, items, total));

      closeCart();
      clearCart();
      setOrderId(id);
    } catch (err) {
      console.error("[checkout]", err);
      toast.error("Erro ao finalizar pedido. Tente novamente.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-28 md:pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-sm text-[var(--color-text-primary)] font-medium">Checkout</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">

          {/* ── LEFT: form ───────────────────────────────── */}
          <div className="space-y-5">

            {/* Customer info */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Seus Dados</h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Nome</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{user.displayName}</p>
                  </div>
                  <Input
                    label="WhatsApp para contato"
                    type="tel"
                    placeholder="(83) 99999-9999"
                    icon={<Phone className="w-4 h-4" />}
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Delivery address */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Endereço de Entrega</h2>
                </div>

                {/* Saved addresses */}
                {savedAddresses.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide mb-2">Endereços salvos</p>
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => applySaved(addr)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedSavedId === addr.id
                            ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] hover:border-[var(--color-neon-blue)]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{addr.label}</span>
                          {addr.isDefault && <Badge variant="default" className="text-[10px]">Padrão</Badge>}
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                          {addr.street}, {addr.number}{addr.complement ? `, ${addr.complement}` : ""}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {addr.neighborhood} — {addr.city}/{addr.state}
                        </p>
                      </button>
                    ))}

                    {/* New address toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSavedId(null);
                        setZip(""); setStreet(""); setNumber(""); setComplement("");
                        setNeighborhood(""); setCity(""); setState("");
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-2 ${
                        selectedSavedId === null && !street
                          ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] hover:border-[var(--color-neon-blue)]/40"
                      }`}
                    >
                      <Plus className="w-4 h-4 text-[var(--color-neon-blue)]" />
                      <span className="text-sm text-[var(--color-text-secondary)]">Novo endereço</span>
                    </button>
                  </div>
                )}

                {/* Address form */}
                <div className="space-y-3">
                  {/* ZIP */}
                  <div className="relative">
                    <Input
                      label="CEP *"
                      placeholder="58000-000"
                      value={zip}
                      onChange={(e) => handleCep(e.target.value)}
                      icon={cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_100px] gap-3">
                    <Input
                      label="Rua / Avenida *"
                      placeholder="Rua das Flores"
                      value={street}
                      onChange={(e) => { setStreet(e.target.value); setSelectedSavedId(null); }}
                    />
                    <Input
                      label="Número *"
                      placeholder="123"
                      value={number}
                      onChange={(e) => { setNumber(e.target.value); setSelectedSavedId(null); }}
                    />
                  </div>

                  <Input
                    label="Complemento"
                    placeholder="Apto 4, Bloco B..."
                    value={complement}
                    onChange={(e) => { setComplement(e.target.value); setSelectedSavedId(null); }}
                  />

                  <Input
                    label="Bairro *"
                    placeholder="Centro"
                    value={neighborhood}
                    onChange={(e) => { setNeighborhood(e.target.value); setSelectedSavedId(null); }}
                  />

                  <div className="grid grid-cols-[1fr_80px] gap-3">
                    <Input
                      label="Cidade *"
                      placeholder="João Pessoa"
                      value={city}
                      onChange={(e) => { setCity(e.target.value); setSelectedSavedId(null); }}
                    />
                    <Input
                      label="UF *"
                      placeholder="PB"
                      value={state}
                      maxLength={2}
                      onChange={(e) => { setState(e.target.value.toUpperCase()); setSelectedSavedId(null); }}
                    />
                  </div>

                  {/* Save address */}
                  {!selectedSavedId && (
                    <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-4 h-4 accent-[var(--color-neon-blue)] cursor-pointer"
                      />
                      <span className="text-sm text-[var(--color-text-secondary)]">Salvar este endereço no meu perfil</span>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Forma de Pagamento</h2>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  {PAYMENT_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPayment(value)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        payment === value
                          ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] hover:border-[var(--color-neon-blue)]/40"
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${payment === value ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"}`} />
                      <p className={`text-sm font-semibold ${payment === value ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-primary)]"}`}>
                        {label}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>

                {payment === "pix_manual" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-[var(--color-neon-blue-glow)]/30 border border-[var(--color-neon-blue)]/20 text-xs text-[var(--color-text-muted)]">
                      <span className="font-medium text-[var(--color-neon-blue)]">PIX: </span>
                      A chave e o QR Code serão exibidos após a confirmação do pedido. Envie o comprovante pelo WhatsApp para liberarmos a entrega.
                    </div>
                  </motion.div>
                )}
                {payment === "on_delivery" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 overflow-hidden"
                  >
                    <Input
                      label="Precisa de troco para quanto?"
                      placeholder="Ex: R$ 100,00 (opcional)"
                      value={notes.startsWith("Troco") ? notes : ""}
                      onChange={(e) => setNotes(e.target.value ? `Troco para ${e.target.value}` : "")}
                    />
                  </motion.div>
                )}
                {payment === "whatsapp" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-3 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-xs text-[var(--color-text-muted)]">
                      <span className="font-medium text-[var(--color-success)]">WhatsApp: </span>
                      Ao confirmar, você poderá abrir uma conversa com a nossa equipe para combinar o pagamento.
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Observações do Pedido</h2>
                <textarea
                  rows={3}
                  value={payment === "on_delivery" ? "" : notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={payment === "on_delivery"}
                  placeholder="Alguma instrução especial para o entregador? (opcional)"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none disabled:opacity-40"
                />
              </CardContent>
            </Card>

            {/* CTA — mobile only */}
            <div className="lg:hidden">
              <Button
                variant="premium"
                size="lg"
                className="w-full"
                disabled={!canSubmit || placing}
                onClick={handlePlaceOrder}
              >
                {placing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                  : <><ShoppingBag className="w-4 h-4" /> Confirmar Pedido — {formatCurrency(total)}</>
                }
              </Button>
              {!canSubmit && (
                <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">
                  Preencha o endereço completo para continuar
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: order summary (sticky) ────────────── */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Receipt className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Resumo do Pedido</h2>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                </div>

                {/* Items */}
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-overlay)] border border-[var(--color-border)] overflow-hidden shrink-0 relative">
                        {item.image
                          ? <Image src={item.image} alt={item.name} fill className="object-cover" />
                          : <Package className="w-5 h-5 text-[var(--color-text-muted)] absolute inset-0 m-auto" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Qtd: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="mb-4" />

                {/* Totals */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Entrega</span>
                    <span className={deliveryFee === 0 ? "text-[var(--color-success)] font-medium" : "text-[var(--color-text-secondary)]"}>
                      {deliveryFee === 0 ? "Grátis" : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-overlay)] rounded-lg px-3 py-2">
                      <Truck className="w-3 h-3 shrink-0" />
                      Frete grátis acima de {formatCurrency(150)}
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span className="text-[var(--color-text-primary)]">Total</span>
                    <span className="text-[var(--color-neon-blue)] text-lg">{formatCurrency(total)}</span>
                  </div>
                  {pointsToEarn > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-warning)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 rounded-lg px-3 py-2 mt-1">
                      <Star className="w-3.5 h-3.5 shrink-0" />
                      Você ganhará <strong>{pointsToEarn.toLocaleString("pt-BR")} pontos</strong> quando o pedido for entregue
                    </div>
                  )}
                </div>

                {/* CTA desktop */}
                <div className="hidden lg:block space-y-2">
                  <Button
                    variant="premium"
                    size="lg"
                    className="w-full"
                    disabled={!canSubmit || placing}
                    onClick={handlePlaceOrder}
                  >
                    {placing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                      : <><ShoppingBag className="w-4 h-4" /> Confirmar Pedido</>
                    }
                  </Button>
                  {!canSubmit && (
                    <p className="text-xs text-[var(--color-text-muted)] text-center">
                      Preencha o endereço completo para continuar
                    </p>
                  )}
                </div>

                {/* Security note */}
                <div className="mt-3 flex items-center gap-2 justify-center text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-success)]">🔒</span>
                  Pedido seguro e protegido
                </div>
              </CardContent>
            </Card>

            {/* Edit cart link */}
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              Quer alterar os itens?{" "}
              <button
                onClick={() => { router.back(); }}
                className="text-[var(--color-neon-blue)] hover:underline"
              >
                Voltar ao carrinho
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
