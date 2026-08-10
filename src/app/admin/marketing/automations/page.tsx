"use client";

import { useEffect, useMemo, useState } from "react";
import { Workflow, Wand2, Save, RotateCcw, Info, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarketingNav } from "@/components/admin/marketing/MarketingNav";
import { useMarketingData } from "@/components/admin/marketing/useMarketingData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  createMarketingAutomation, updateMarketingAutomation, deleteMarketingAutomation, saveMarketingTemplate, saveMarketingSettings,
  type MarketingAutomationInput,
} from "@/lib/firebase/marketing";
import { TEMPLATE_PRESETS, presetFor } from "@/lib/marketing/templates";
import { PLACEHOLDER_HELP } from "@/lib/marketing/placeholders";
import {
  AUTOMATION_EVENT_LABELS, AUTOMATION_EVENT_DESCRIPTIONS,
} from "@/lib/marketing/priorities";
import { getCategories } from "@/lib/firebase/categories";
import { getProducts } from "@/lib/firebase/products";
import type { MarketingAutomation, MarketingAutomationEvent, MarketingAutomationConfig, MarketingAutomationCoupon, MarketingTemplate } from "@/types/marketing";
import type { Category } from "@/types";
import type { CouponType } from "@/types";

const CONFIG_DEFAULTS: Record<MarketingAutomationEvent, MarketingAutomationConfig> = {
  welcome: {},
  first_purchase: {},
  birthday: { birthdayDaysBefore: 0 },
  abandoned_cart: { cartHours: 24 },
  points_expiring: { pointsExpireInDays: 7 },
  big_spender: {},
  inactive_30: { inactiveDays: 30 },
  inactive_60: {},
  promo_product: { promoAudience: "previous_buyers" },
};

function defaultCoupon(): MarketingAutomationCoupon {
  return { type: "percent", value: 10, expiresInDays: 7, usageLimitPerCpf: 1 };
}

function AutomationCard({ automation, categories, productNames, onSaved }: {
  automation: MarketingAutomation;
  categories: Category[];
  productNames: string[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(automation.title);
  const [message, setMessage] = useState(automation.message);
  const [link, setLink] = useState(automation.link ?? "");
  const [config, setConfig] = useState<MarketingAutomationConfig>(automation.config ?? {});
  const [hasCoupon, setHasCoupon] = useState(Boolean(automation.coupon));
  const [couponType, setCouponType] = useState<CouponType>(automation.coupon?.type ?? "percent");
  const [couponValue, setCouponValue] = useState(automation.coupon ? String(automation.coupon.value) : "10");
  const [minOrder, setMinOrder] = useState(automation.coupon?.minOrder != null ? String(automation.coupon.minOrder) : "");
  const [expiresInDays, setExpiresInDays] = useState(automation.coupon ? String(automation.coupon.expiresInDays) : "7");
  const [usageLimit, setUsageLimit] = useState(automation.coupon?.usageLimitPerCpf != null ? String(automation.coupon.usageLimitPerCpf) : "1");
  const [saving, setSaving] = useState(false);

  const setCfg = (patch: Partial<MarketingAutomationConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const handleToggle = async (active: boolean) => {
    try {
      await updateMarketingAutomation(automation.id, { active });
      onSaved();
    } catch {
      toast.error("Erro ao alterar a automação.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Excluir a automação "${automation.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteMarketingAutomation(automation.id);
      toast.success("Automação excluída.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao excluir.");
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      toast.warning("Preencha título e mensagem.");
      return;
    }
    setSaving(true);
    try {
      await updateMarketingAutomation(automation.id, {
        title: title.trim(),
        message: message.trim(),
        ...(link.trim() ? { link: link.trim() } : { link: undefined }),
        config,
        ...(hasCoupon ? {
          coupon: {
            type: couponType,
            value: Number(couponValue) || 0,
            ...(minOrder.trim() ? { minOrder: Number(minOrder) } : {}),
            expiresInDays: Number(expiresInDays) || 7,
            ...(usageLimit.trim() ? { usageLimitPerCpf: Number(usageLimit) } : {}),
          },
        } : { coupon: undefined }),
      });
      toast.success("Automação salva.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const numInput = (label: string, value: number | undefined, onChange: (n: number) => void, placeholder?: string) => (
    <Input label={label} type="number" min={0} value={value != null ? String(value) : ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)} placeholder={placeholder} />
  );

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>{automation.name}</CardTitle>
            <Badge variant="premium">{AUTOMATION_EVENT_LABELS[automation.event]}</Badge>
          </div>
          <CardDescription className="mt-1">{AUTOMATION_EVENT_DESCRIPTIONS[automation.event]}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${automation.active ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}`}>
            {automation.active ? "Ativa" : "Pausada"}
          </span>
          <Switch checked={automation.active} onCheckedChange={handleToggle} />
          <button
            onClick={handleDelete}
            title="Excluir automação"
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config do trigger */}
        {(automation.event === "inactive_30" || (automation.event === "promo_product")) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {automation.event === "inactive_30" && numInput("Dias sem compra para disparar", config.inactiveDays, (n) => setCfg({ inactiveDays: n }))}
            {automation.event === "promo_product" && (
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Público-alvo</label>
                <select value={config.promoAudience ?? "previous_buyers"}
                  onChange={(e) => setCfg({ promoAudience: e.target.value as MarketingAutomationConfig["promoAudience"] })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                  <option value="previous_buyers">Quem já comprou</option>
                  <option value="vip">Clientes VIP</option>
                  <option value="never_bought">Quem nunca comprou</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>
            )}
          </div>
        )}
        {automation.event === "promo_product" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Categoria em destaque</label>
              <select value={config.productCategory ?? ""} onChange={(e) => setCfg({ productCategory: e.target.value || undefined })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                <option value="">Qualquer</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Produto em destaque (nome)</label>
              <input list="marketing-products" value={config.productId ?? ""}
                onChange={(e) => setCfg({ productId: e.target.value || undefined })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]"
                placeholder="Nome do produto" />
              <datalist id="marketing-products">
                {productNames.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>
        )}
        {automation.event === "birthday" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numInput("Dias antes do aniversário", config.birthdayDaysBefore, (n) => setCfg({ birthdayDaysBefore: n }), "0 = no dia")}
          </div>
        )}
        {automation.event === "abandoned_cart" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numInput("Horas com o carrinho abandonado", config.cartHours, (n) => setCfg({ cartHours: n }))}
          </div>
        )}
        {automation.event === "points_expiring" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numInput("Dias antes de expirar", config.pointsExpireInDays, (n) => setCfg({ pointsExpireInDays: n }))}
          </div>
        )}

        {/* Mensagem */}
        <div className="grid grid-cols-1 gap-3">
          <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Mensagem</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)]" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PLACEHOLDER_HELP.map((p) => (
                <button key={p.token} type="button" title={p.description}
                  onClick={() => setMessage((prev) => `${prev}${prev ? " " : ""}${p.token}`)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)] transition-colors">
                  {p.token}
                </button>
              ))}
            </div>
          </div>
          <Input label="Link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ex: /catalog" />
        </div>

        {/* Cupom */}
        <div className="flex items-center gap-3">
          <Switch checked={hasCoupon} onCheckedChange={setHasCoupon} />
          <span className="text-sm text-[var(--color-text-secondary)]">Gerar cupom (1 por dia, compartilhado)</span>
        </div>
        {hasCoupon && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {(["percent", "fixed"] as CouponType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setCouponType(t)}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      couponType === t ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                       : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                    }`}>
                    {t === "percent" ? "%" : "R$"}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Valor" type="number" min={1} value={couponValue} onChange={(e) => setCouponValue(e.target.value)} />
            <Input label="Mín. pedido" type="number" min={0} step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="Opc." />
            <Input label="Validade (dias)" type="number" min={1} value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
            <Input label="Limite/CPF" type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Opc." />
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="premium" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar automação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesTab({ templates, onSaved }: { templates: MarketingTemplate[]; onSaved: () => void }) {
  const [edits, setEdits] = useState<Record<string, { title: string; message: string; link: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const save = async (t: MarketingTemplate) => {
    const edit = edits[t.id];
    if (!edit || !edit.title.trim() || !edit.message.trim()) {
      toast.warning("Preencha título e mensagem.");
      return;
    }
    setSavingId(t.id);
    try {
      await saveMarketingTemplate(t.id, {
        name: t.name,
        ...(t.event ? { event: t.event } : {}),
        title: edit.title.trim(),
        message: edit.message.trim(),
        ...(edit.link.trim() ? { link: edit.link.trim() } : {}),
      });
      toast.success("Template salvo.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao salvar o template.");
    } finally {
      setSavingId(null);
    }
  };

  const reset = (t: MarketingTemplate) => {
    const preset = presetFor(t.event as MarketingAutomationEvent);
    if (!preset) return;
    setEdits((e) => ({ ...e, [t.id]: { title: preset.title, message: preset.message, link: preset.link ?? "" } }));
    toast.info("Template restaurado — clique em salvar para aplicar.");
  };

  return (
    <div className="space-y-4">
      {templates.map((t) => {
        const edit = edits[t.id] ?? { title: t.title, message: t.message, link: t.link ?? "" };
        return (
          <Card key={t.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.event && <Badge variant="secondary">{AUTOMATION_EVENT_LABELS[t.event]}</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => reset(t)}>
                    <RotateCcw className="w-4 h-4" /> Padrão
                  </Button>
                  <Button variant="premium" size="sm" disabled={savingId === t.id} onClick={() => save(t)}>
                    {savingId === t.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Título" value={edit.title} onChange={(e) => setEdits((x) => ({ ...x, [t.id]: { ...edit, title: e.target.value } }))} />
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Mensagem</label>
                <textarea value={edit.message} onChange={(e) => setEdits((x) => ({ ...x, [t.id]: { ...edit, message: e.target.value } }))} rows={3}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)]" />
              </div>
              <Input label="Link" value={edit.link} onChange={(e) => setEdits((x) => ({ ...x, [t.id]: { ...edit, link: e.target.value } }))} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SettingsTab({ settings, onSaved }: { settings: NonNullable<ReturnType<typeof useMarketingData>["data"]["settings"]>; onSaved: () => void }) {
  const [form, setForm] = useState({
    active: settings.active,
    maxPerDay: String(settings.maxPerDay),
    windowHours: String(settings.windowHours),
    minDaysBetweenAuto: String(settings.minDaysBetweenAuto),
    bigSpenderThreshold: String(settings.bigSpenderThreshold),
    maxAudiencePerCampaign: String(settings.maxAudiencePerCampaign),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveMarketingSettings({
        active: form.active,
        maxPerDay: Number(form.maxPerDay) || 2,
        windowHours: Number(form.windowHours) || 24,
        minDaysBetweenAuto: Number(form.minDaysBetweenAuto) || 7,
        bigSpenderThreshold: Number(form.bigSpenderThreshold) || 400,
        maxAudiencePerCampaign: Number(form.maxAudiencePerCampaign) || 200,
      });
      toast.success("Configurações salvas.");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)] px-4 py-3">
        <Info className="w-5 h-5 text-[var(--color-neon-blue)] shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          O cron roda <strong>uma vez por dia</strong> (16h no horário de Brasília). As execuções são idempotentes
          (doc id = chave) — rodar de novo no mesmo dia não duplica mensagens nem cupons.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Marketing ativo</p>
              <p className="text-xs text-[var(--color-text-muted)]">Kill switch global do cron</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
          </label>
          <Input label="Máx. mensagens por cliente na janela" type="number" min={1}
            value={form.maxPerDay} onChange={(e) => setForm((f) => ({ ...f, maxPerDay: e.target.value }))} />
          <Input label="Janela anti-spam (horas)" type="number" min={1}
            value={form.windowHours} onChange={(e) => setForm((f) => ({ ...f, windowHours: e.target.value }))} />
          <Input label="Intervalo entre automáticas (dias)" type="number" min={0}
            value={form.minDaysBetweenAuto} onChange={(e) => setForm((f) => ({ ...f, minDaysBetweenAuto: e.target.value }))} />
          <Input label="Limite de VIP / grandes compradores (R$)" type="number" min={0}
            value={form.bigSpenderThreshold} onChange={(e) => setForm((f) => ({ ...f, bigSpenderThreshold: e.target.value }))} />
          <Input label="Máx. destinatários por campanha" type="number" min={1}
            value={form.maxAudiencePerCampaign} onChange={(e) => setForm((f) => ({ ...f, maxAudiencePerCampaign: e.target.value }))} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="premium" disabled={saving} onClick={save}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

export default function MarketingAutomationsPage() {
  const { user } = useAuthStore();
  const { data, loading, reload } = useMarketingData();
  const [tab, setTab] = useState<"automations" | "templates" | "settings">("automations");
  const [categories, setCategories] = useState<Category[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getProducts().then((ps) => setProductNames(ps.map((p) => p.name).filter(Boolean))).catch(() => undefined);
  }, []);

  const sorted = useMemo(
    () => [...data.automations].sort((a, b) => {
      const order = Object.keys(AUTOMATION_EVENT_LABELS);
      return order.indexOf(a.event) - order.indexOf(b.event);
    }),
    [data.automations],
  );

  const createDefaults = async () => {
    const existing = new Set(data.automations.filter((a) => a.event).map((a) => a.event));
    const missing = TEMPLATE_PRESETS.filter((t) => !existing.has(t.event));
    if (missing.length === 0) {
      toast.info("Todas as automações padrão já existem.");
      return;
    }
    try {
      for (const preset of missing) {
        const input: MarketingAutomationInput = {
          name: preset.name,
          event: preset.event,
          title: preset.title,
          message: preset.message,
          ...(preset.link ? { link: preset.link } : {}),
          config: CONFIG_DEFAULTS[preset.event],
          coupon: defaultCoupon(),
          active: true,
        };
        await createMarketingAutomation(input);
      }
      toast.success(`${missing.length} automação(ões) padrão criada(s).`);
      reload();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao criar automações padrão.");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-[var(--color-text-primary)] font-semibold">Acesso restrito</p>
          <p className="text-sm text-[var(--color-text-muted)]">Apenas o admin acessa o Marketing/CRM.</p>
        </div>
      </div>
    );
  }

  const TABS = [
    { v: "automations" as const, label: `Automações (${data.automations.length})` },
    { v: "templates" as const, label: `Templates (${data.templates.length})` },
    { v: "settings" as const, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader
          title="Automações"
          subtitle="Fluxos automáticos disparados pelo cron diário (anti-spam e prioridade embutidos)"
          action={
            tab === "automations" ? (
              <Button variant="secondary" onClick={createDefaults}>
                <Wand2 className="w-4 h-4" /> Criar padrão
              </Button>
            ) : undefined
          }
        />

        <MarketingNav />

        <div className="flex gap-1.5 mb-6">
          {TABS.map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                tab === t.v
                  ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        ) : tab === "automations" ? (
          sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Workflow className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">Nenhuma automação criada.</p>
              <Button variant="premium" onClick={createDefaults}><Wand2 className="w-4 h-4" /> Criar automações padrão</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((a) => (
                <AutomationCard key={a.id} automation={a} categories={categories} productNames={productNames} onSaved={reload} />
              ))}
            </div>
          )
        ) : tab === "templates" ? (
          <TemplatesTab templates={data.templates} onSaved={reload} />
        ) : (
          <SettingsTab settings={data.settings} onSaved={reload} />
        )}
      </div>
    </div>
  );
}
