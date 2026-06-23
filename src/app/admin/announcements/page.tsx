"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Megaphone, Plus, Trash2, Eye, EyeOff, Pencil, X, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  getAllAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} from "@/lib/firebase/announcements";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import type { Announcement } from "@/types";

const EMPTY = { title: "", body: "", link: "", active: true };

export default function AdminAnnouncements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  // Recarrega após mutações (chamado de handlers, nunca de efeito).
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await getAllAnnouncements());
    } catch {
      toast.error("Não foi possível carregar os avisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial inline (setState só em callback async — evita warning de
  // setState síncrono em efeito).
  useEffect(() => {
    getAllAnnouncements()
      .then(setList)
      .catch(() => toast.error("Não foi possível carregar os avisos."))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setForm({ title: a.title, body: a.body, link: a.link ?? "", active: a.active });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, {
          title: form.title.trim(),
          body: form.body.trim(),
          link: form.link.trim(),
          active: form.active,
        });
        toast.success("Aviso atualizado!");
      } else {
        await createAnnouncement({
          title: form.title.trim(),
          body: form.body.trim(),
          link: form.link.trim() || undefined,
          active: form.active,
        });
        toast.success("Promoção publicada! Os clientes verão no sininho.");
      }
      resetForm();
      await reload();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: Announcement) {
    try {
      await updateAnnouncement(a.id, { active: !a.active });
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    } catch {
      toast.error("Erro ao atualizar.");
    }
  }

  async function remove(id: string) {
    try {
      await deleteAnnouncement(id);
      setList((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) resetForm();
      toast.success("Aviso excluído.");
    } catch {
      toast.error("Erro ao excluir.");
    }
  }

  const activeCount = list.filter((a) => a.active).length;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <AdminPageHeader
          title="Avisos & Promoções"
          subtitle="Publique promoções que aparecem no sininho de notificações dos clientes."
          action={<Badge variant="default">{activeCount} ativo{activeCount !== 1 ? "s" : ""}</Badge>}
        />

        {/* Form criar/editar */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[var(--color-neon-blue)]" />
              {editingId ? "Editar aviso" : "Nova promoção"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Título</label>
              <Input
                value={form.title}
                maxLength={60}
                placeholder="Ex.: Seda em promoção!"
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Mensagem</label>
              <textarea
                value={form.body}
                maxLength={200}
                rows={2}
                placeholder="Ex.: Só esta semana: essa seda por apenas R$20. Aproveite!"
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Link ao tocar (opcional)</label>
              <Input
                value={form.link}
                placeholder="Ex.: /catalog?cat=sedas ou /catalog?produto=<id>"
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                className="mt-1.5"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                Para onde o cliente vai ao tocar na notificação. Deixe vazio para apenas avisar.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {form.active ? "Visível para os clientes" : "Oculto (rascunho)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {editingId && (
                  <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving}>
                    <X className="w-4 h-4" /> Cancelar
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving} className="min-w-28">
                  {saving ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
                  ) : editingId ? (
                    <><Save className="w-4 h-4" /> Salvar</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Publicar</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Carregando avisos...</p>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Megaphone className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">Nenhuma promoção publicada ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {list.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge variant={a.active ? "success" : "secondary"}>{a.active ? "Ativo" : "Oculto"}</Badge>
                        <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">{a.title}</span>
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatDateTime(a.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2 whitespace-pre-wrap">{a.body}</p>
                    {a.link && (
                      <p className="text-xs font-mono text-[var(--color-neon-blue)] mb-3 truncate">{a.link}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => toggleActive(a)}
                        className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {a.active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {a.active ? "Ocultar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => remove(a.id)}
                        className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 text-xs font-medium text-[var(--color-error)] hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
