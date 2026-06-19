"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, Plus, X, Trash2, Pencil, AlertCircle, Shield,
  Percent, DollarSign, CalendarClock, Tag, Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import {
  getCoupons, createCoupon, updateCoupon, deleteCoupon, type CouponInput,
} from "@/lib/firebase/coupons";
import { getCategories } from "@/lib/firebase/categories";
import { normalizeCouponCode } from "@/lib/coupons";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Coupon, Category, CouponType } from "@/types";

/* ── Create/Edit modal ───────────────────────────────────── */
function CouponModal({ editing, categories, onClose, onSaved }: {
  editing: Coupon | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [type, setType] = useState<CouponType>(editing?.type ?? "percent");
  const [value, setValue] = useState(editing ? String(editing.value) : "");
  const [minOrder, setMinOrder] = useState(editing?.minOrder != null ? String(editing.minOrder) : "");
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ?? "");
  const [usageLimitPerCpf, setUsageLimitPerCpf] = useState(
    editing?.usageLimitPerCpf != null ? String(editing.usageLimitPerCpf) : "",
  );
  const [cats, setCats] = useState<string[]>(editing?.categories ?? []);
  const [active, setActive] = useState(editing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleCat = (slug: string) =>
    setCats((prev) => prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valueNum = Number(value);
    if (!valueNum || valueNum <= 0) { setError("Informe um valor de desconto maior que zero."); return; }
    if (type === "percent" && valueNum > 100) { setError("O percentual não pode passar de 100%."); return; }
    if (!editing && !normalizeCouponCode(code)) { setError("Informe o código do cupom."); return; }

    const data: CouponInput = {
      type,
      value: valueNum,
      active,
      minOrder: minOrder.trim() ? Number(minOrder) : undefined,
      expiresAt: expiresAt || undefined,
      usageLimitPerCpf: usageLimitPerCpf.trim() ? Number(usageLimitPerCpf) : undefined,
      categories: cats.length ? cats : undefined,
    };

    setSaving(true);
    try {
      if (editing) await updateCoupon(editing.id, data);
      else await createCoupon(code, data);
      toast.success(editing ? "Cupom atualizado!" : "Cupom criado!");
      onSaved();
    } catch (err) {
      setError((err as Error).message ?? "Não foi possível salvar o cupom.");
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
            {editing ? "Editar Cupom" : "Novo Cupom"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Código *"
            placeholder="Ex: SHARK10"
            icon={<Tag className="w-4 h-4" />}
            value={code}
            onChange={(e) => setCode(normalizeCouponCode(e.target.value))}
            disabled={!!editing}
          />

          {/* Type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "percent", label: "%", icon: Percent },
                  { v: "fixed", label: "R$", icon: DollarSign },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const on = type === opt.v;
                  return (
                    <button key={opt.v} type="button" onClick={() => setType(opt.v)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        on ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                           : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                      }`}>
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              label={type === "percent" ? "Desconto (%) *" : "Desconto (R$) *"}
              type="number"
              min={1}
              step={type === "percent" ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "Ex: 10" : "Ex: 25"}
            />
          </div>

          {/* Restrictions */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Pedido mínimo (R$)"
              type="number" min={0} step="0.01"
              icon={<DollarSign className="w-4 h-4" />}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="Opcional"
            />
            <Input
              label="Validade"
              type="date"
              icon={<CalendarClock className="w-4 h-4" />}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <Input
            label="Limite de uso por CPF"
            type="number" min={1} step={1}
            value={usageLimitPerCpf}
            onChange={(e) => setUsageLimitPerCpf(e.target.value)}
            placeholder="Opcional — vazio = ilimitado"
          />

          {/* Categories */}
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
              Restringir a categorias <span className="text-[var(--color-text-muted)]">(opcional — vazio = todas)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.length === 0 && (
                <span className="text-xs text-[var(--color-text-muted)]">Nenhuma categoria cadastrada.</span>
              )}
              {categories.map((c) => {
                const on = cats.includes(c.slug);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCat(c.slug)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                         : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-neon-blue)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Cupom ativo</span>
          </label>

          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" variant="premium" className="flex-1" disabled={saving}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : (editing ? "Salvar" : "Criar cupom")}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function AdminCouponsPage() {
  const { user } = useAuthStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const catLabel = useCallback(
    (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug,
    [categories],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, cats] = await Promise.all([getCoupons(true), getCategories()]);
      setCoupons(cs);
      setCategories(cats);
    } catch (err) {
      // Surface the real cause (permission-denied, project mismatch, etc.) —
      // sem isso o erro fica invisível e impossível de diagnosticar em produção.
      console.error("[coupons] falha ao carregar:", err);
      const code = (err as { code?: string })?.code;
      const msg = (err as Error)?.message ?? String(err);
      toast.error(`Não foi possível carregar os cupons.${code ? ` (${code})` : ""} ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canAccess = user?.role === "admin" || user?.role === "seller";
  if (!canAccess) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-[var(--color-text-primary)] font-semibold">Acesso restrito</p>
          <p className="text-sm text-[var(--color-text-muted)]">Apenas admin e vendedores acessam esta área.</p>
        </div>
      </div>
    );
  }

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Coupon) => { setEditing(c); setModalOpen(true); };

  const handleToggleActive = async (c: Coupon) => {
    setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, active: !c.active } : x));
    try {
      await updateCoupon(c.id, { active: !c.active });
    } catch {
      setCoupons((prev) => prev.map((x) => x.id === c.id ? { ...x, active: c.active } : x));
      toast.error("Erro ao alterar o cupom.");
    }
  };

  const handleDelete = async (c: Coupon) => {
    setDeletingId(c.id);
    try {
      await deleteCoupon(c.id);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Cupom removido.");
    } catch {
      toast.error("Erro ao remover o cupom.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <AdminPageHeader
            title="Cupons"
            subtitle={`${coupons.length} cupom${coupons.length !== 1 ? "ns" : ""} cadastrado${coupons.length !== 1 ? "s" : ""}`}
            action={<Button variant="premium" onClick={openNew}><Plus className="w-4 h-4" /> Novo cupom</Button>}
          />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-2xl" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <Ticket className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">Nenhum cupom cadastrado</p>
              <Button variant="secondary" onClick={openNew}><Plus className="w-4 h-4" /> Criar o primeiro</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {coupons.map((c) => {
                const expired = c.expiresAt ? new Date().toISOString().slice(0, 10) > c.expiresAt : false;
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-warning)]/10 flex items-center justify-center shrink-0">
                          <Ticket className="w-5 h-5 text-[var(--color-warning)]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[var(--color-text-primary)]">{c.code}</span>
                            <Badge variant={c.type === "percent" ? "default" : "secondary"}>
                              {c.type === "percent" ? `${c.value}% OFF` : `${formatCurrency(c.value)} OFF`}
                            </Badge>
                            {!c.active && <Badge variant="destructive">Inativo</Badge>}
                            {expired && <Badge variant="destructive">Expirado</Badge>}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex flex-wrap gap-x-2">
                            {c.minOrder != null && <span>mín. {formatCurrency(c.minOrder)}</span>}
                            {c.expiresAt && <span>· até {formatDate(c.expiresAt)}</span>}
                            {c.usageLimitPerCpf != null && <span>· {c.usageLimitPerCpf}×/CPF</span>}
                            {c.categories?.length ? <span>· {c.categories.map(catLabel).join(", ")}</span> : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggleActive(c)} title={c.active ? "Desativar" : "Ativar"}
                          className={`p-2 rounded-lg transition-all ${c.active ? "text-[var(--color-success)] hover:bg-[var(--color-success)]/10" : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"}`}>
                          <Power className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(c)} title="Editar"
                          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c)} disabled={deletingId === c.id} title="Remover"
                          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all disabled:opacity-40">
                          {deletingId === c.id
                            ? <div className="w-4 h-4 border-2 border-[var(--color-error)]/30 border-t-[var(--color-error)] rounded-full animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <CouponModal
            editing={editing}
            categories={categories}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); load(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
