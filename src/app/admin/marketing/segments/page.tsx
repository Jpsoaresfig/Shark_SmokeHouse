"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Split, Plus, X, Trash2, Pencil, Power, Wand2, Users, Megaphone } from "lucide-react";
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
import { createMarketingSegment, updateMarketingSegment, deleteMarketingSegment, type MarketingSegmentInput } from "@/lib/firebase/marketing";
import { resolveAudience } from "@/lib/marketing/segmentation";
import { presetSegmentDraft, SEGMENT_PRESETS, type SegmentPreset } from "@/lib/marketing/presets";
import {
  SEGMENT_FIELD_LABELS, SEGMENT_OPERATOR_LABELS, SEGMENT_KIND_LABELS, SEGMENT_PRESET_LABELS,
} from "@/lib/marketing/priorities";
import { LOYALTY_LEVELS } from "@/lib/loyalty/levels";
import type {
  MarketingSegment, MarketingSegmentField, MarketingSegmentKind, MarketingSegmentOperator, MarketingSegmentRule,
} from "@/types/marketing";

function emptyRule(): MarketingSegmentRule {
  return { field: "totalSpent", op: "gte", value: 0 };
}

/** Segmentos "carrinho abandonado" sem regras são exclusivos de automações. */
function isAutomationOnlySegment(seg: MarketingSegment): boolean {
  return seg.preset === "carrinho_abandonado" && seg.rules.length === 0;
}

function SegmentModal({ editing, onClose, onSaved }: {
  editing: MarketingSegment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [kind, setKind] = useState<MarketingSegmentKind>(editing?.kind ?? "rules");
  const [rules, setRules] = useState<MarketingSegmentRule[]>(editing?.rules?.length ? editing.rules : [emptyRule()]);
  const [userIdsText, setUserIdsText] = useState(editing?.userIds?.join("\n") ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateRule = (i: number, patch: Partial<MarketingSegmentRule>) =>
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Dê um nome ao segmento."); return; }

    const normalizedRules = rules
      .map((r) => ({ ...r, value: r.value }))
      .filter((r) => r.field && r.op && r.value !== "" && r.value !== null);

    const userIds = userIdsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (kind === "rules" && normalizedRules.length === 0) { setError("Adicione ao menos uma regra."); return; }
    if (kind === "manual" && userIds.length === 0) { setError("Adicione ao menos um uid."); return; }

    const data: MarketingSegmentInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      kind: kind === "all" ? "all" : kind === "manual" ? "manual" : "rules",
      rules: kind === "rules" ? normalizedRules : [],
      userIds: kind === "manual" ? userIds : [],
      active,
    };

    setSaving(true);
    try {
      if (editing) await updateMarketingSegment(editing.id, data);
      else await createMarketingSegment(data);
      toast.success(editing ? "Segmento atualizado!" : "Segmento criado!");
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível salvar o segmento.");
    } finally {
      setSaving(false);
    }
  };

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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {editing ? "Editar segmento" : "Novo segmento"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Clientes da zona sul" />
          <Input label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />

          {/* Kind */}
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(["rules", "manual", "all"] as MarketingSegmentKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    kind === k ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                  }`}>
                  {SEGMENT_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Rules */}
          {kind === "rules" && (
            <div className="space-y-2.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block">Regras (TODAS devem valer — AND)</label>
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(i, { field: e.target.value as MarketingSegmentField })}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-2.5 text-sm text-[var(--color-text-primary)]"
                  >
                    {Object.entries(SEGMENT_FIELD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={rule.op}
                    onChange={(e) => updateRule(i, { op: e.target.value as MarketingSegmentOperator })}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-2.5 text-sm text-[var(--color-text-primary)]"
                  >
                    {Object.entries(SEGMENT_OPERATOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <RuleValueInput rule={rule} onChange={(value) => updateRule(i, { value })} />
                  <button type="button" onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setRules((prev) => [...prev, emptyRule()])}>
                <Plus className="w-4 h-4" /> Adicionar regra
              </Button>
            </div>
          )}

          {/* Manual */}
          {kind === "manual" && (
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
                Uids (um por linha) *
              </label>
              <textarea
                value={userIdsText}
                onChange={(e) => setUserIdsText(e.target.value)}
                rows={4}
                placeholder="uid-do-cliente-1&#10;uid-do-cliente-2"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)]"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-neon-blue)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Segmento ativo (pode receber campanhas)</span>
          </label>

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="premium" className="flex-1" disabled={saving}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function RuleValueInput({ rule, onChange }: { rule: MarketingSegmentRule; onChange: (v: string | number | boolean) => void }) {
  if (rule.field === "hasPhone" || rule.field === "hasCpf") {
    return (
      <button type="button" onClick={() => onChange(rule.value !== true)}
        className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${
          rule.value === true
            ? "border-[var(--color-success)] bg-emerald-500/10 text-[var(--color-success)]"
            : "border-[var(--color-error)] bg-red-500/10 text-[var(--color-error)]"
        }`}>
        {rule.value === true ? "Sim" : "Não"}
      </button>
    );
  }
  if (rule.field === "loyaltyLevel") {
    return (
      <select
        value={String(rule.value)}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-2.5 text-sm text-[var(--color-text-primary)]"
      >
        {LOYALTY_LEVELS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={String(rule.value)}
      onChange={(e) => {
        const v = e.target.value;
        const numeric = /^\d+(\.\d+)?$/.test(v);
        onChange(numeric ? Number(v) : v);
      }}
      className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-2.5 text-sm text-[var(--color-text-primary)]"
    />
  );
}

function rulesPreview(segment: MarketingSegment): string {
  if (segment.kind === "manual") return `${segment.userIds.length} cliente(s) na lista`;
  if (segment.kind === "all") return "Todos os clientes";
  if (segment.rules.length === 0) return "Sem regras (avaliado por sessão)";
  return segment.rules.map((r) => `${SEGMENT_FIELD_LABELS[r.field]} ${SEGMENT_OPERATOR_LABELS[r.op]} ${String(r.value)}`).join(" · ");
}

export default function MarketingSegmentsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { data, loading, reload } = useMarketingData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingSegment | null>(null);

  const audienceOf = useMemo(() => {
    const contacts = data.contacts;
    const sessionsByUid = new Map(data.sessions.map((s) => [s.userId, s]));
    const map = new Map<string, number>();
    for (const seg of data.segments) {
      if (seg.preset === "carrinho_abandonado") {
        let count = 0;
        for (const [uid, s] of sessionsByUid) {
          if (s.itemsCount > 0 && contacts.some((c) => c.uid === uid)) count++;
        }
        map.set(seg.id, count);
      } else {
        map.set(seg.id, resolveAudience(seg, contacts).length);
      }
    }
    return map;
  }, [data.segments, data.contacts, data.sessions]);

  const createPresets = async () => {
    const existing = new Set(data.segments.filter((s) => s.preset).map((s) => s.preset));
    const toCreate = SEGMENT_PRESETS.filter((p) => !existing.has(p.preset)).map((p) => p.preset) as SegmentPreset[];
    if (toCreate.length === 0) {
      toast.info("Todos os segmentos padrão já existem.");
      return;
    }
    try {
      for (const preset of toCreate) {
        await createMarketingSegment(presetSegmentDraft(preset, data.settings));
      }
      toast.success(`${toCreate.length} segmento(s) padrão criado(s).`);
      reload();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao criar segmentos padrão.");
    }
  };

  const handleToggle = async (seg: MarketingSegment) => {
    try {
      await updateMarketingSegment(seg.id, { active: !seg.active });
      reload();
    } catch {
      toast.error("Erro ao alterar o segmento.");
    }
  };

  const handleDelete = async (seg: MarketingSegment) => {
    try {
      await deleteMarketingSegment(seg.id);
      toast.success("Segmento removido.");
      reload();
    } catch {
      toast.error("Erro ao remover o segmento.");
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

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader
          title="Segmentos"
          subtitle={`${data.segments.length} segmento(s) de público`}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={createPresets}>
                <Wand2 className="w-4 h-4" /> Criar padrão
              </Button>
              <Button variant="premium" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="w-4 h-4" /> Novo segmento
              </Button>
            </div>
          }
        />

        <MarketingNav />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : data.segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Split className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhum segmento criado.</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={createPresets}><Wand2 className="w-4 h-4" /> Criar segmentos padrão</Button>
              <Button variant="premium" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="w-4 h-4" /> Criar manual</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.segments.map((seg) => {
              const audience = audienceOf.get(seg.id) ?? 0;
              return (
                <Card key={seg.id}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[var(--color-text-primary)]">{seg.name}</span>
                        {seg.preset && <Badge variant="premium">{SEGMENT_PRESET_LABELS[seg.preset]}</Badge>}
                        <Badge variant="secondary">{SEGMENT_KIND_LABELS[seg.kind]}</Badge>
                        {!seg.active && <Badge variant="destructive">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{rulesPreview(seg)}</p>
                      {seg.description && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{seg.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Users className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">{audience}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">cliente(s) no público</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isAutomationOnlySegment(seg) && (
                        <Button variant="secondary" size="sm"
                          onClick={() => router.push(`/admin/marketing/campaigns?segment=${seg.id}`)}>
                          <Megaphone className="w-4 h-4" /> Campanha
                        </Button>
                      )}
                      <button onClick={() => handleToggle(seg)} title={seg.active ? "Desativar" : "Ativar"}
                        className={`p-2 rounded-lg transition-all ${seg.active ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"}`}>
                        <Power className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditing(seg); setModalOpen(true); }} title="Editar"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(seg)} title="Remover"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalOpen && (
          <SegmentModal
            editing={editing}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); reload(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
