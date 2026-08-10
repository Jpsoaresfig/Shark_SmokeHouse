"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, X, Trash2, Pencil, Send, CalendarClock, Ban, BarChart3, Users, AlertCircle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarketingNav } from "@/components/admin/marketing/MarketingNav";
import { useMarketingData } from "@/components/admin/marketing/useMarketingData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  createMarketingCampaign, updateMarketingCampaign, deleteMarketingCampaign, executeCampaignNow,
  type MarketingCampaignInput,
} from "@/lib/firebase/marketing";
import { resolveAudience } from "@/lib/marketing/segmentation";
import { campaignStats } from "@/lib/marketing/metrics";
import { PLACEHOLDER_HELP } from "@/lib/marketing/placeholders";
import {
  CAMPAIGN_STATUS_LABELS, CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_CHANNEL_LABELS,
} from "@/lib/marketing/priorities";
import { formatDateTime } from "@/lib/utils";
import type { MarketingCampaign, MarketingCampaignObjective, MarketingChannel, MarketingContact, MarketingEvent, MarketingExecution, MarketingSegment } from "@/types/marketing";
import type { CouponType } from "@/types";

/** Segmentos "carrinho abandonado" sem regras são exclusivos de automações:
 *  seu público vem das sessões de carrinho e não é alcançável por campanha. */
function isAutomationOnlySegment(seg: MarketingSegment): boolean {
  return seg.preset === "carrinho_abandonado" && seg.rules.length === 0;
}

function audienceOfSegment(
  segmentId: string,
  contacts: MarketingContact[],
  segments: MarketingSegment[],
): number {
  const seg = segments.find((s) => s.id === segmentId);
  if (!seg) return 0;
  if (isAutomationOnlySegment(seg)) return 0;
  return resolveAudience(seg, contacts).length;
}

function CampaignModal({ editing, preselectSegment, onClose, onSaved }: {
  editing: MarketingCampaign | null;
  preselectSegment?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuthStore();
  const { data } = useMarketingData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [objective, setObjective] = useState<MarketingCampaignObjective>(editing?.objective ?? "recover");
  const [channel, setChannel] = useState<MarketingChannel>(editing?.channel ?? "app");
  const [segmentId, setSegmentId] = useState(editing?.segmentId ?? preselectSegment ?? data.segments[0]?.id ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [message, setMessage] = useState(editing?.message ?? "");
  const [link, setLink] = useState(editing?.link ?? "");
  const [couponMode, setCouponMode] = useState<"none" | "generate" | "existing">(
    editing?.coupon ? "generate" : editing?.couponCode ? "existing" : "none",
  );
  const [couponType, setCouponType] = useState<CouponType>(editing?.coupon?.type ?? "percent");
  const [couponValue, setCouponValue] = useState(editing?.coupon ? String(editing.coupon.value) : "10");
  const [minOrder, setMinOrder] = useState(editing?.coupon?.minOrder != null ? String(editing.coupon.minOrder) : "");
  const [expiresInDays, setExpiresInDays] = useState(editing?.coupon ? String(editing.coupon.expiresInDays) : "7");
  const [usageLimit, setUsageLimit] = useState(editing?.coupon?.usageLimitPerCpf != null ? String(editing.coupon.usageLimitPerCpf) : "1");
  const [existingCode, setExistingCode] = useState(editing?.couponCode ?? data.coupons[0]?.code ?? "");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const audience = segmentId ? audienceOfSegment(segmentId, data.contacts, data.segments) : 0;
  const couponOptions = data.coupons;

  const insertPlaceholder = (token: string) => setMessage((prev) => `${prev}${prev ? " " : ""}${token}`);

  const buildInput = (status: MarketingCampaign["status"], scheduledFor: string): MarketingCampaignInput => ({
    name: name.trim(),
    description: description.trim() || undefined,
    segmentId,
    objective,
    channel,
    title: title.trim(),
    message: message.trim(),
    ...(link.trim() ? { link: link.trim() } : {}),
    ...(couponMode === "existing" && existingCode ? { couponCode: existingCode } : {}),
    ...(couponMode === "generate" ? {
      coupon: {
        type: couponType,
        value: Number(couponValue),
        ...(minOrder.trim() ? { minOrder: Number(minOrder) } : {}),
        expiresInDays: Number(expiresInDays) || 7,
        ...(usageLimit.trim() ? { usageLimitPerCpf: Number(usageLimit) } : {}),
      },
    } : {}),
    status,
    scheduledFor,
  });

  const validate = () => {
    setError("");
    if (!name.trim()) return "Dê um nome à campanha.";
    if (channel === "whatsapp") return "Canal WhatsApp é de envio manual (wa.me) — use o canal Notificação (app) ou envie pelo botão WhatsApp na página de Clientes.";
    if (!segmentId) return "Selecione o segmento-alvo.";
    const seg = data.segments.find((s) => s.id === segmentId);
    if (!seg) return "Segmento-alvo inválido.";
    if (isAutomationOnlySegment(seg)) return "O segmento 'Carrinho abandonado' sem regras é exclusivo para automações — não pode ser usado em campanhas.";
    if (!title.trim()) return "Escreva o título da mensagem.";
    if (!message.trim()) return "Escreva a mensagem.";
    if (couponMode === "generate" && (!couponValue || Number(couponValue) <= 0)) return "Informe o valor do cupom.";
    if (couponMode === "generate" && couponType === "percent" && Number(couponValue) > 100) return "Percentual acima de 100%.";
    if (couponMode === "existing" && !existingCode) return "Selecione o cupom existente.";
    return "";
  };

  const persist = async (input: MarketingCampaignInput) => {
    if (editing) {
      await updateMarketingCampaign(editing.id, input);
      return editing.id;
    }
    return createMarketingCampaign(input);
  };

  const handleAction = async (action: "draft" | "now" | "schedule") => {
    const err = validate();
    if (err) { setError(err); return; }
    if (action === "schedule" && !scheduledLocal) { setError("Informe a data/hora do agendamento."); return; }
    if (action === "now") {
      const seg = data.segments.find((s) => s.id === segmentId);
      if (!seg || !seg.active) { setError("O segmento-alvo está inativo — ative-o antes de enviar."); return; }
    }
    if (action === "schedule") {
      const when = new Date(scheduledLocal);
      if (when.getTime() <= Date.now()) { setError("Agende para um horário no futuro."); return; }
    }

    setSaving(true);
    try {
      const scheduledFor = action === "schedule" ? new Date(scheduledLocal).toISOString() : "";
      const id = await persist(buildInput(action === "draft" ? "draft" : "scheduled", scheduledFor));
      if (action === "now" && user) {
        const result = await executeCampaignNow(id, user.uid);
        toast.success(`Campanha enviada para ${result.planned} cliente(s).`);
      } else if (action === "schedule") {
        toast.success("Campanha agendada!");
      } else {
        toast.success("Rascunho salvo.");
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível salvar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  const steps = ["Básico", "Mensagem", "Cupom"];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 220 }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {editing ? "Editar campanha" : "Nova campanha"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 mb-5">
          {steps.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                i === step ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                : i < step ? "border-[var(--color-success)]/40 bg-emerald-500/10 text-[var(--color-success)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
              }`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <Input label="Nome da campanha *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Recuperar clientes em risco — setembro" />
            <Input label="Descrição (interna)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Objetivo *</label>
                <select value={objective} onChange={(e) => setObjective(e.target.value as MarketingCampaignObjective)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                  {Object.entries(CAMPAIGN_OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Canal *</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as MarketingChannel)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                  {Object.entries(CAMPAIGN_CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Segmento-alvo *</label>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                {data.segments.filter((s) => !isAutomationOnlySegment(s)).map((s) => <option key={s.id} value={s.id}>{s.name} {!s.active ? "(inativo)" : ""}</option>)}
              </select>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
                <Users className="w-3.5 h-3.5" />
                <span><span className="font-semibold text-[var(--color-text-primary)]">{audience}</span> cliente(s) no público</span>
              </div>
            </div>
            {channel === "whatsapp" && (
              <p className="text-xs text-[var(--color-warning)] rounded-lg border border-[var(--color-warning)]/30 bg-amber-500/10 px-3 py-2">
                Canal WhatsApp é de envio manual: abra a lista de clientes e use o botão &quot;WhatsApp&quot; para cada um.
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Input label="Título (notificação) *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Temos um mimo pra você 🦈" />
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Mensagem *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Ex: Olá, {{nome}}! Já faz {{dias_sem_comprar}} dias sem te ver..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PLACEHOLDER_HELP.map((p) => (
                  <button key={p.token} type="button" onClick={() => insertPlaceholder(p.token)} title={p.description}
                    className="text-[11px] px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)] transition-colors">
                    {p.token}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Link (destino ao tocar)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ex: /catalog?produto=abc" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Cupom</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "none", label: "Sem cupom" },
                  { v: "generate", label: "Gerar no envio" },
                  { v: "existing", label: "Usar existente" },
                ] as const).map((o) => (
                  <button key={o.v} type="button" onClick={() => setCouponMode(o.v)}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      couponMode === o.v ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                         : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {couponMode === "generate" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
                  <Input label="Valor *" type="number" min={1} step={couponType === "percent" ? 1 : 0.01}
                    value={couponValue} onChange={(e) => setCouponValue(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Pedido mín. (R$)" type="number" min={0} step="0.01" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="Opc." />
                  <Input label="Validade (dias) *" type="number" min={1} value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
                  <Input label="Limite/CPF" type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Opc." />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  O código (ex.: SHARK-XXXXXX) é gerado no momento do envio e incluído em cada mensagem como <code className="text-[var(--color-neon-blue)]">{"{{cupom}}"}</code>.
                </p>
              </div>
            )}

            {couponMode === "existing" && (
              <div>
                <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Cupom existente</label>
                <select value={existingCode} onChange={(e) => setExistingCode(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)]">
                  {couponOptions.length === 0 && <option value="">Nenhum cupom cadastrado</option>}
                  {couponOptions.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Agendamento</label>
              <Input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
                <p className="text-sm text-[var(--color-error)]">{error}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 mt-4 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={saving}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 2 ? (
            <Button type="button" variant="premium" className="flex-1" onClick={() => setStep((s) => s + 1)}>
              Continuar
            </Button>
          ) : (
            <div className="flex flex-1 gap-2 flex-wrap">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => handleAction("draft")}>
                Rascunho
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => handleAction("schedule")}>
                <CalendarClock className="w-4 h-4" /> Agendar
              </Button>
              <Button type="button" variant="premium" disabled={saving} onClick={() => handleAction("now")}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />} Enviar agora
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MetricsModal({ campaign, executions, events, redemptions, onClose }: {
  campaign: MarketingCampaign;
  executions: MarketingExecution[];
  events: MarketingEvent[];
  redemptions: { couponId: string; code: string; createdAt: string }[];
  onClose: () => void;
}) {
  const own = executions.filter((e) => e.campaignId === campaign.id);
  const stats = campaignStats(own, events.filter((e) => e.campaignId === campaign.id));
  const redemptionsFor = campaign.couponCode
    ? redemptions.filter((r) => r.couponId === campaign.couponCode || r.code === campaign.couponCode)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 220 }}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Métricas — {campaign.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Enviadas</p>
            <p className="text-xl font-black text-[var(--color-text-primary)] mt-0.5">{stats.sent}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Erros</p>
            <p className="text-xl font-black text-[var(--color-error)] mt-0.5">{stats.errored}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Toques (link)</p>
            <p className="text-xl font-black text-[var(--color-neon-blue)] mt-0.5">{stats.clicks}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
            <p className="text-[10px] uppercase text-[var(--color-text-muted)]">CTR</p>
            <p className="text-xl font-black text-[var(--color-success)] mt-0.5">{stats.ctr}%</p>
          </div>
        </div>
        {campaign.couponCode && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 mb-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Cupom <code className="text-[var(--color-neon-blue)] font-mono">{campaign.couponCode}</code>
            </span>
            <Badge variant="premium">{redemptionsFor.length} uso(s)</Badge>
          </div>
        )}
        <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Últimas execuções</p>
        <div className="space-y-2">
          {own.slice(0, 8).map((e) => (
            <div key={e.createdAt + e.message} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2">
              <p className="text-sm text-[var(--color-text-primary)] truncate">{e.message}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {e.status} · {formatDateTime(e.createdAt)}
              </p>
            </div>
          ))}
          {own.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">Nenhuma execução ainda.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CampaignsContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading, reload } = useMarketingData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [metricsFor, setMetricsFor] = useState<MarketingCampaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const preselect = searchParams.get("segment") ?? undefined;
  const segmentName = (id: string) => data.segments.find((s) => s.id === id)?.name ?? "—";

  const handleSendNow = async (c: MarketingCampaign) => {
    if (!user) return;
    if (!window.confirm(`Enviar a campanha "${c.name}" para o público agora?`)) return;
    setSendingId(c.id);
    try {
      const result = await executeCampaignNow(c.id, user.uid);
      toast.success(`Enviada para ${result.planned} cliente(s) (${result.deduped} deduplicados, ${result.skippedSpam} anti-spam).`);
      reload();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao enviar a campanha.");
    } finally {
      setSendingId(null);
    }
  };

  const handleCancel = async (c: MarketingCampaign) => {
    if (!window.confirm(`Cancelar a campanha "${c.name}"?`)) return;
    try {
      await updateMarketingCampaign(c.id, { status: "cancelled" });
      toast.success("Campanha cancelada.");
      reload();
    } catch {
      toast.error("Erro ao cancelar a campanha.");
    }
  };

  const handleDelete = async (c: MarketingCampaign) => {
    if (!window.confirm(`Excluir a campanha "${c.name}"?`)) return;
    try {
      await deleteMarketingCampaign(c.id);
      toast.success("Campanha removida.");
      reload();
    } catch {
      toast.error("Erro ao remover a campanha.");
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

  const statusVariant = (s: string): "default" | "secondary" | "success" | "destructive" | "warning" => {
    switch (s) {
      case "sent": return "success";
      case "scheduled": return "warning";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader
          title="Campanhas"
          subtitle={`${data.campaigns.length} campanha(s)`}
          action={
            <Button variant="premium" onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Nova campanha
            </Button>
          }
        />

        <MarketingNav />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : data.campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Megaphone className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhuma campanha criada.</p>
            <Button variant="premium" onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Criar a primeira
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.campaigns.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[var(--color-text-primary)]">{c.name}</span>
                      <Badge variant={statusVariant(c.status)}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
                      <Badge variant="secondary">{CAMPAIGN_OBJECTIVE_LABELS[c.objective]}</Badge>
                      <Badge variant="secondary">{CAMPAIGN_CHANNEL_LABELS[c.channel]}</Badge>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Público: <span className="text-[var(--color-text-primary)] font-medium">{segmentName(c.segmentId)}</span></span>
                      {c.scheduledFor && c.status === "scheduled" && <span>· Agendada: {formatDateTime(c.scheduledFor)}</span>}
                      {c.sentAt && <span>· Enviada em: {formatDateTime(c.sentAt)}</span>}
                      {c.sentCount != null && <span>· <span className="text-[var(--color-text-primary)] font-medium">{c.sentCount}</span> mensagem(ns)</span>}
                      {c.couponCode && <span>· Cupom: <code className="font-mono text-[var(--color-neon-blue)]">{c.couponCode}</code></span>}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1 truncate">{c.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.status !== "sent" && c.status !== "cancelled" && (
                      <Button variant="premium" size="sm" disabled={sendingId === c.id} onClick={() => handleSendNow(c)}>
                        {sendingId === c.id
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Send className="w-4 h-4" />}
                        {sendingId === c.id ? "Enviando…" : "Enviar"}
                      </Button>
                    )}
                    {c.status === "scheduled" && (
                      <button onClick={() => handleCancel(c)} title="Cancelar"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all">
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setMetricsFor(c)} title="Métricas"
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all">
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    {c.status !== "sent" && (
                      <button onClick={() => { setEditing(c); setModalOpen(true); }} title="Editar"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(c)} title="Excluir"
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <CampaignModal
            editing={editing}
            preselectSegment={preselect}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); reload(); router.replace("/admin/marketing/campaigns"); }}
          />
        )}
        {metricsFor && (
          <MetricsModal
            campaign={metricsFor}
            executions={data.executions}
            events={data.events}
            redemptions={data.redemptions}
            onClose={() => setMetricsFor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MarketingCampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsContent />
    </Suspense>
  );
}
