"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Save, RefreshCw, Truck, Megaphone, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CloudinaryUpload } from "@/components/ui/CloudinaryUpload";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase/settings";
import { getActiveProducts } from "@/lib/firebase/products";
import { toast } from "@/stores/toastStore";
import { DAY_LABELS_FULL, DAY_LABELS, isOpenNow, formatTodayStatus } from "@/lib/businessHours";
import type { SiteSettings, Product, BusinessHours } from "@/types";

const SECTION_META: {
  key: keyof SiteSettings["sections"];
  label: string;
  description: string;
}[] = [
  {
    key: "hero",
    label: "Banner Principal",
    description: "Seção de destaque no topo da página com chamada para ação.",
  },
  {
    key: "featuredProducts",
    label: "Produtos em Destaque",
    description: "Grelha de produtos selecionados exibidos na página inicial.",
  },
  {
    key: "lounge",
    label: "Lounge / Agendamento",
    description: "Reserva do lounge premium. Ao desativar, some de todo o site (menu, rodapé, página inicial e a página de agendamento).",
  },
  {
    key: "events",
    label: "Próximos Eventos",
    description: "Exibe os próximos eventos cadastrados na página inicial.",
  },
];

export default function AdminSections() {
  const [sections, setSections] = useState<SiteSettings["sections"]>({
    hero: true,
    featuredProducts: true,
    lounge: true,
    events: true,
  });
  const [cart, setCart] = useState<SiteSettings["cart"]>({
    freeShippingEnabled: true,
    freeShippingThreshold: 150,
  });
  const [promo, setPromo] = useState<SiteSettings["promoPopup"]>({
    enabled: false,
    title: "",
    message: "",
    imageUrl: "",
    ctaLabel: "Quero aproveitar",
    linkUrl: "/catalog",
  });
  const [hours, setHours] = useState<BusinessHours>({
    enabled: false,
    days: [null, null, null, null, null, null, null],
    closedMessage: "",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSiteSettings();
      setSections(s.sections);
      setCart(s.cart);
      setPromo(s.promoPopup);
      if (s.businessHours) setHours(s.businessHours);
    } catch {
      toast.error("Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getActiveProducts().then(setProducts).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSiteSettings({
        sections,
        cart: {
          freeShippingEnabled: cart.freeShippingEnabled,
          freeShippingThreshold: Math.max(0, Number(cart.freeShippingThreshold) || 0),
        },
        promoPopup: {
          enabled: promo.enabled,
          title: promo.title.trim(),
          message: promo.message.trim(),
          imageUrl: promo.imageUrl?.trim() || "",
          ctaLabel: promo.ctaLabel?.trim() || "Quero aproveitar",
          linkUrl: promo.linkUrl?.trim() || "/catalog",
        },
        businessHours: {
          enabled: hours.enabled,
          days: hours.days.map((d) => (d ? { ...d } : null)),
          closedMessage: hours.closedMessage.trim(),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  /** Produto atualmente mirado pelo link do popup (parse de /catalog?produto=<id>). */
  const promoProductId = (() => {
    const m = promo.linkUrl?.match(/[?&]produto=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  })();

  function setPromoTarget(productId: string) {
    setPromo((prev) => ({
      ...prev,
      linkUrl: productId ? `/catalog?produto=${productId}` : "/catalog",
    }));
  }

  function toggle(key: keyof SiteSettings["sections"]) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /** Liga/desliga um dia da semana (setado = aberto, desligado = fechado). */
  function toggleDay(day: number) {
    setHours((prev) => {
      const days = [...prev.days];
      if (days[day]) {
        days[day] = null;
      } else {
        days[day] = { open: "09:00", close: "22:00" };
      }
      return { ...prev, days };
    });
  }

  /** Atualiza o horário de abertura/fechamento de um dia. */
  function setDayTime(day: number, field: "open" | "close", value: string) {
    setHours((prev) => {
      const days = [...prev.days];
      const cur = days[day] ?? { open: "09:00", close: "22:00" };
      days[day] = { ...cur, [field]: value };
      return { ...prev, days };
    });
  }

  const configuredDays = hours.days.filter(Boolean).length;
  const nowStatus = isOpenNow(hours);
  const todaySummary = formatTodayStatus(hours);

  const activeCount = Object.values(sections).filter(Boolean).length;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AdminPageHeader
          title="Site & Vitrine"
          subtitle="Seções da página inicial, frete grátis e popup promocional."
          action={<Badge variant="default">{activeCount}/{SECTION_META.length} seções</Badge>}
        />

        {/* Sections list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Visibilidade das Seções</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-0 divide-y divide-[var(--color-border)]">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-5 animate-pulse">
                      <div className="space-y-2">
                        <div className="h-4 w-40 rounded bg-[var(--color-bg-overlay)]" />
                        <div className="h-3 w-64 rounded bg-[var(--color-bg-overlay)]" />
                      </div>
                      <div className="h-6 w-11 rounded-full bg-[var(--color-bg-overlay)]" />
                    </div>
                  ))
                : SECTION_META.map((meta, i) => {
                    const active = sections[meta.key];
                    return (
                      <motion.div
                        key={meta.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between py-5 gap-4"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              active
                                ? "bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20"
                                : "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]"
                            }`}
                          >
                            {active ? (
                              <Eye className="w-4 h-4 text-[var(--color-neon-blue)]" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-[var(--color-text-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold transition-colors ${
                                active
                                  ? "text-[var(--color-text-primary)]"
                                  : "text-[var(--color-text-muted)]"
                              }`}
                            >
                              {meta.label}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs font-medium transition-colors ${
                              active
                                ? "text-[var(--color-neon-blue)]"
                                : "text-[var(--color-text-muted)]"
                            }`}
                          >
                            {active ? "Ativa" : "Oculta"}
                          </span>
                          <Switch
                            checked={active}
                            onCheckedChange={() => toggle(meta.key)}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Carrinho & Frete grátis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Frete Grátis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Barra de frete grátis no carrinho
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Mostra ao cliente quanto falta para ganhar frete grátis e zera o frete no checkout ao atingir o valor. Desligue se não quiser oferecer.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      cart.freeShippingEnabled
                        ? "text-[var(--color-neon-blue)]"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {cart.freeShippingEnabled ? "Ligado" : "Desligado"}
                  </span>
                  <Switch
                    checked={cart.freeShippingEnabled}
                    onCheckedChange={(v) => setCart((prev) => ({ ...prev, freeShippingEnabled: v }))}
                  />
                </div>
              </div>

              <div className={cart.freeShippingEnabled ? "" : "opacity-50 pointer-events-none"}>
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Valor mínimo de compra para frete grátis (R$)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={cart.freeShippingThreshold}
                  onChange={(e) =>
                    setCart((prev) => ({ ...prev, freeShippingThreshold: Number(e.target.value) }))
                  }
                  className="mt-1.5 max-w-[180px]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                  Pedidos com subtotal de produtos a partir deste valor ganham frete grátis na entrega.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Horário de Funcionamento */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-6"
        >
          <Card className={hours.enabled ? "" : "border-[var(--color-border)]"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Limitar compras ao horário de funcionamento
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Quando ligado, o horário aparece na página inicial e pedidos fora dele são reservados (entram na fila de espera) — o cliente vê o motivo e o processamento começa assim que a loja abrir.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      hours.enabled ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {hours.enabled ? "Ligado" : "Desligado"}
                  </span>
                  <Switch
                    checked={hours.enabled}
                    onCheckedChange={(v) => setHours((prev) => ({ ...prev, enabled: v }))}
                  />
                </div>
              </div>

              {/* Status de hoje + aviso de não configurado */}
              <div
                className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 border text-xs ${
                  hours.enabled && !nowStatus.open
                    ? "border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]"
                    : hours.enabled
                      ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                }`}
              >
                <span className="font-semibold">Hoje ({DAY_LABELS_FULL[new Date().getDay()]}):</span>
                <span>{todaySummary}</span>
                {hours.enabled && (
                  <span className="ml-auto font-medium">
                    {nowStatus.open ? "Aberto agora" : "Fechado agora — pedidos entram na fila de espera"}
                  </span>
                )}
              </div>

              {configuredDays === 0 && (
                <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2.5 text-xs text-[var(--color-warning)]">
                  Que horário estamos abertos hoje? Defina os dias abaixo para o horário valer no site.
                </div>
              )}

              {/* Dias da semana */}
              <div className="grid gap-2 sm:grid-cols-2">
                {DAY_LABELS.map((label, day) => {
                  const dayHours = hours.days[day];
                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        dayHours
                          ? "border-[var(--color-neon-blue)]/30 bg-[var(--color-bg-overlay)]"
                          : "border-[var(--color-border)] bg-transparent opacity-60"
                      }`}
                    >
                      <Switch checked={!!dayHours} onCheckedChange={() => toggleDay(day)} className="shrink-0" />
                      <span className={`text-xs font-semibold w-16 shrink-0 ${dayHours ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}>
                        {label}
                      </span>
                      {dayHours ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Input
                            type="time"
                            value={dayHours.open}
                            onChange={(e) => setDayTime(day, "open", e.target.value)}
                            className="h-8 w-[110px] text-xs px-2"
                          />
                          <span className="text-xs text-[var(--color-text-muted)]">às</span>
                          <Input
                            type="time"
                            value={dayHours.close}
                            onChange={(e) => setDayTime(day, "close", e.target.value)}
                            className="h-8 w-[110px] text-xs px-2"
                          />
                        </div>
                      ) : (
                        <span className="ml-auto text-xs text-[var(--color-text-muted)]">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-1.5">
                  Mensagem exibida quando a loja está fechada (opcional)
                </label>
                <textarea
                  value={hours.closedMessage}
                  maxLength={140}
                  rows={2}
                  placeholder="Ex.: Estamos fechados no momento. Volte entre 10h e 22h!"
                  onChange={(e) => setHours((prev) => ({ ...prev, closedMessage: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Popup Promocional */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Popup Promocional
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Mostrar popup de promoção na loja
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Aparece uma vez por visita. O cliente pode fechar ou clicar para ir direto à oferta.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      promo.enabled ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {promo.enabled ? "Ligado" : "Desligado"}
                  </span>
                  <Switch
                    checked={promo.enabled}
                    onCheckedChange={(v) => setPromo((prev) => ({ ...prev, enabled: v }))}
                  />
                </div>
              </div>

              <div className={`space-y-4 ${promo.enabled ? "" : "opacity-50 pointer-events-none"}`}>
                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Chamada (destaque)
                  </label>
                  <Input
                    value={promo.title}
                    maxLength={40}
                    placeholder="Ex.: IMPERDÍVEL"
                    onChange={(e) => setPromo((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Texto da promoção
                  </label>
                  <textarea
                    value={promo.message}
                    maxLength={140}
                    rows={2}
                    placeholder="Ex.: Essa seda por apenas R$20! Só hoje."
                    onChange={(e) => setPromo((prev) => ({ ...prev, message: e.target.value }))}
                    className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] block mb-1.5">
                    Imagem (opcional)
                  </label>
                  <CloudinaryUpload
                    value={promo.imageUrl ? [promo.imageUrl] : []}
                    onChange={(urls) => setPromo((prev) => ({ ...prev, imageUrl: urls[0] ?? "" }))}
                    maxImages={1}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Botão leva para
                    </label>
                    <select
                      value={promoProductId}
                      onChange={(e) => setPromoTarget(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
                    >
                      <option value="">Catálogo (geral)</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                      Escolha um produto para o cliente cair direto na ficha dele e comprar.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Texto do botão
                    </label>
                    <Input
                      value={promo.ctaLabel ?? ""}
                      maxLength={28}
                      placeholder="Quero aproveitar"
                      onChange={(e) => setPromo((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 flex items-center justify-between"
        >
          <Button variant="ghost" size="sm" onClick={load} disabled={loading || saving}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="min-w-32">
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Save className="w-4 h-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar alterações
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
