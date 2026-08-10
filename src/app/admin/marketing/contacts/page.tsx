"use client";

import { useMemo, useState } from "react";
import { Users, Search, MessageCircle, Copy, Download, PhoneOff, ChevronLeft, ChevronRight } from "lucide-react";
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
import { categorizeContact, SEGMENT_PRESETS, type SegmentPreset } from "@/lib/marketing/presets";
import { buildMessageVars, renderMessage } from "@/lib/marketing/placeholders";
import { waLink, digitsOfPhone, prettyPhone } from "@/lib/marketing/whatsapp";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { MarketingContact, MarketingTemplate } from "@/types/marketing";

const PAGE_SIZE = 25;

type ContactFilter = "todos" | SegmentPreset | "nunca_comprou" | "com_whatsapp";

const FILTER_OPTIONS: { value: ContactFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vip", label: "VIP" },
  { value: "recorrente", label: "Recorrente" },
  { value: "em_risco", label: "Em risco" },
  { value: "perdido", label: "Perdido" },
  { value: "aniversariante", label: "Aniversariante" },
  { value: "nunca_comprou", label: "Nunca comprou" },
  { value: "com_whatsapp", label: "Com WhatsApp" },
];

const PRESET_BADGE: Record<SegmentPreset, "default" | "success" | "warning" | "destructive" | "premium" | "secondary" | "pink" | "purple" | "orange"> = {
  vip: "premium",
  recorrente: "success",
  em_risco: "warning",
  perdido: "destructive",
  aniversariante: "pink",
  primeira_compra: "default",
  carrinho_abandonado: "secondary",
  pontos_expirando: "purple",
};

function defaultMessage(contact: MarketingContact): string {
  return renderMessage(
    "Olá, {{nome}}! Este é um lembrete da Shark SmokeHouse. 🦈",
    buildMessageVars(contact),
  );
}

function messageFromTemplate(contact: MarketingContact, template?: MarketingTemplate): string {
  if (!template) return defaultMessage(contact);
  return renderMessage(template.message, buildMessageVars(contact, {
    link: template.link,
    diasSemComprar: contact.daysSinceActivity,
  }));
}

function contactCsv(contacts: MarketingContact[], settings: { bigSpenderThreshold: number }): string {
  const header = "Nome;Telefone;Email;Cidade;Bairro;Gasto total;Pedidos;Ultima compra;Pontos;Nivel;Segmentos;Cadastro";
  const lines = contacts.map((c) => {
    const segments = categorizeContact(c, settings).map((s) => SEGMENT_PRESETS.find((p) => p.preset === s)?.name ?? s).join(", ");
    return [
      c.name, prettyPhone(c.phone), c.email, c.city ?? "", c.neighborhood ?? "",
      String(c.totalSpent), String(c.ordersCount),
      c.lastOrderAt ? formatDate(c.lastOrderAt) : "", String(c.loyaltyPoints), c.loyaltyLevel,
      segments, c.createdAt ? formatDate(c.createdAt) : "",
    ].join(";");
  });
  return [header, ...lines].join("\n");
}

export default function MarketingContactsPage() {
  const { user } = useAuthStore();
  const { data, loading } = useMarketingData();
  const [filter, setFilter] = useState<ContactFilter>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categorized = new Map<string, SegmentPreset[]>(
      data.contacts.map((c) => [c.uid, categorizeContact(c, data.settings)]),
    );
    return data.contacts.filter((c) => {
      if (q && !`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "todos":
          return true;
        case "nunca_comprou":
          return c.ordersCount === 0;
        case "com_whatsapp":
          return digitsOfPhone(c.phone).length >= 12;
        default:
          return categorized.get(c.uid)?.includes(filter) ?? false;
      }
    });
  }, [data.contacts, data.settings, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const templateList = data.templates;

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

  const openWhatsApp = (c: MarketingContact, template?: MarketingTemplate) => {
    const message = messageFromTemplate(c, template);
    const link = waLink(c.phone, message);
    if (!link) {
      toast.warning("Cliente sem telefone cadastrado.");
      return;
    }
    window.open(link, "_blank");
    toast.success("WhatsApp aberto — envio manual. Registre o resultado no atendimento.");
  };

  const exportCsv = () => {
    const blob = new Blob([`\uFEFF${contactCsv(filtered, data.settings)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-marketing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader
          title="Clientes"
          subtitle={`${data.contacts.length} clientes na base · ${data.contacts.filter((c) => digitsOfPhone(c.phone).length >= 12).length} com WhatsApp`}
          action={
            <Button variant="secondary" onClick={exportCsv} disabled={loading || filtered.length === 0}>
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          }
        />

        <MarketingNav />

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="flex-1">
            <Input
              icon={<Search className="w-4 h-4" />}
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === opt.value
                  ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Users className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhum cliente encontrado com esses filtros.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visible.map((c) => {
                const segments = categorizeContact(c, data.settings);
                const wa = digitsOfPhone(c.phone).length >= 12;
                return (
                  <Card key={c.uid}>
                    <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--color-text-primary)]">{c.name}</span>
                          {segments.slice(0, 3).map((s) => (
                            <Badge key={s} variant={PRESET_BADGE[s]}>{SEGMENT_PRESETS.find((p) => p.preset === s)?.name}</Badge>
                          ))}
                          {c.ordersCount === 0 && <Badge variant="secondary">Nunca comprou</Badge>}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className={wa ? "" : "text-[var(--color-error)]"}>
                            {wa ? prettyPhone(c.phone) : "Sem WhatsApp"}
                          </span>
                          {c.city && <span>· {c.city}{c.neighborhood ? ` / ${c.neighborhood}` : ""}</span>}
                          <span>· Gasto: <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(c.totalSpent)}</span></span>
                          {c.lastOrderAt && <span>· Última compra: <span className="text-[var(--color-text-primary)] font-medium">{formatDate(c.lastOrderAt)}</span></span>}
                          <span>· Pontos: <span className="text-[var(--color-text-primary)] font-medium">{c.loyaltyPoints}</span> ({c.loyaltyLevel})</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          onChange={(e) => openWhatsApp(c, templateList.find((t) => t.id === e.target.value))}
                          defaultValue=""
                          className="hidden sm:block text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-2 text-[var(--color-text-muted)]"
                        >
                          <option value="">Mensagem padrão</option>
                          {templateList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        {wa ? (
                          <>
                            <Button variant="premium" size="sm" onClick={() => openWhatsApp(c)}>
                              <MessageCircle className="w-4 h-4" /> WhatsApp
                            </Button>
                            <button
                              onClick={() => { navigator.clipboard.writeText(messageFromTemplate(c)); toast.success("Mensagem copiada."); }}
                              title="Copiar mensagem"
                              className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-[var(--color-error)]">
                            <PhoneOff className="w-4 h-4" /> Sem telefone
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {filtered.length} cliente(s) · página {page + 1}/{pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
