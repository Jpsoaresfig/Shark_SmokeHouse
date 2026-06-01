"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Plus, X, Pencil, Trash2, ToggleLeft, ToggleRight,
  Upload, ImageIcon, AlertCircle, Eye, EyeOff, Calendar, Loader2,
} from "lucide-react";
import Image from "next/image";
import { uploadToCloudinary } from "@/components/ui/CloudinaryUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getEvents, createEvent, updateEvent, deleteEvent, toggleEventActive,
} from "@/lib/firebase/events";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/types";

/* ── helpers ─────────────────────────────────────────────── */
function isUpcoming(dateStr: string) {
  return new Date(dateStr) >= new Date(new Date().setHours(0, 0, 0, 0));
}

/* ── Image upload picker (Cloudinary) ────────────────────── */
function ImagePicker({
  current,
  onChange,
  onUploadingChange,
}: {
  current?: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(current ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setPreview(URL.createObjectURL(file)); // preview local imediato
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
      setPreview(url);
    } catch {
      setErr("Falha ao enviar a imagem. Tente novamente.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">
        Imagem do Evento <span className="text-[var(--color-text-muted)] font-normal">(opcional)</span>
      </label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-neon-blue)] transition-colors overflow-hidden aspect-video bg-[var(--color-bg-overlay)] flex items-center justify-center group"
      >
        {preview ? (
          <>
            <Image src={preview} alt="Preview" fill sizes="(max-width: 640px) 100vw, 480px" className="object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
              <span className="text-white text-sm ml-2">Trocar imagem</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)] group-hover:text-[var(--color-neon-blue)] transition-colors">
            <ImageIcon className="w-10 h-10" />
            <span className="text-sm font-medium">Clique para fazer upload</span>
            <span className="text-xs">PNG, JPG, WEBP — recomendado 16:9</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[var(--color-neon-blue)] animate-spin" />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {err && <p className="text-xs text-[var(--color-error)] mt-1.5">{err}</p>}
    </div>
  );
}

/* ── Event Form Modal ────────────────────────────────────── */
function EventModal({
  event,
  onClose,
  onSaved,
}: {
  event?: Event;
  onClose: () => void;
  onSaved: (e: Event) => void;
}) {
  const isEdit = !!event;
  const [form, setForm] = useState({
    title: event?.title ?? "",
    description: event?.description ?? "",
    date: event?.date ?? "",
    active: event?.active ?? true,
  });
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? "");
  const [imgUploading, setImgUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (imgUploading) return; // aguarda o upload da imagem terminar
    setLoading(true);
    try {
      // Imagem é opcional — segue com imageUrl vazio se não houver.
      if (isEdit) {
        await updateEvent(event.id, { ...form, imageUrl });
        onSaved({ ...event, ...form, imageUrl });
      } else {
        const created = await createEvent({ ...form, imageUrl });
        onSaved(created);
      }
    } catch {
      setError("Erro ao salvar evento. Tente novamente.");
    } finally {
      setLoading(false);
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
        className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {isEdit ? "Editar Evento" : "Novo Evento"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ImagePicker
            current={event?.imageUrl}
            onChange={setImageUrl}
            onUploadingChange={setImgUploading}
          />

          <Input
            label="Título do Evento"
            placeholder="Ex: Noite de Jazz & Charutos"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva o evento, atrações, dress code..."
              rows={3}
              required
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] focus:shadow-[0_0_0_3px_var(--color-neon-blue-glow)] transition-all resize-none"
            />
          </div>

          <Input
            type="date"
            label="Data do Evento"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Visível no site</p>
              <p className="text-xs text-[var(--color-text-muted)]">Exibir este evento para os clientes</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, active: !form.active })}
              className="transition-colors"
            >
              {form.active
                ? <ToggleRight className="w-9 h-9 text-[var(--color-neon-blue)]" />
                : <ToggleLeft className="w-9 h-9 text-[var(--color-text-muted)]" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="premium" className="flex-1" disabled={loading || imgUploading}>
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : imgUploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando imagem…</>
                : isEdit ? "Salvar Alterações" : <><Plus className="w-4 h-4" />Criar Evento</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ── Delete confirm ──────────────────────────────────────── */
function DeleteConfirm({ event, onClose, onDeleted }: { event: Event; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    await deleteEvent(event.id, event.imageUrl);
    onDeleted(event.id);
  };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-[var(--color-error)]" />
        </div>
        <h3 className="text-base font-bold text-[var(--color-text-primary)] text-center mb-1">Excluir Evento</h3>
        <p className="text-sm text-[var(--color-text-secondary)] text-center mb-1">
          Tem certeza que deseja excluir
        </p>
        <p className="text-sm font-semibold text-[var(--color-neon-blue)] text-center mb-6">"{event.title}"?</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" className="flex-1" onClick={handle} disabled={loading}>
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Excluir"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEvent, setModalEvent] = useState<Event | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents(await getEvents()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved: Event) => {
    setEvents((prev) => {
      const exists = prev.find((e) => e.id === saved.id);
      return exists ? prev.map((e) => e.id === saved.id ? saved : e) : [saved, ...prev];
    });
    setModalEvent(null);
  };

  const handleDeleted = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDeleteTarget(null);
  };

  const handleToggle = async (event: Event) => {
    setTogglingId(event.id);
    await toggleEventActive(event.id, !event.active);
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, active: !e.active } : e));
    setTogglingId(null);
  };

  const upcoming = events.filter((e) => isUpcoming(e.date));
  const past = events.filter((e) => !isUpcoming(e.date));

  return (
    <>
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          <AdminPageHeader
            title="Eventos"
            subtitle={`${upcoming.length} próximo${upcoming.length !== 1 ? "s" : ""} · ${past.length} passado${past.length !== 1 ? "s" : ""}`}
            action={
              <Button variant="premium" onClick={() => setModalEvent("new")}>
                <Plus className="w-4 h-4" /> Novo Evento
              </Button>
            }
          />

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
                  <div className="skeleton aspect-video" />
                  <div className="p-4 space-y-2">
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
                <CalendarDays className="w-8 h-8 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[var(--color-text-secondary)] font-medium">Nenhum evento criado</p>
              <Button variant="outline" onClick={() => setModalEvent("new")}>
                <Plus className="w-4 h-4" />Criar primeiro evento
              </Button>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                    Próximos eventos
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {upcoming.map((event, i) => (
                      <EventAdminCard
                        key={event.id} event={event} index={i}
                        toggling={togglingId === event.id}
                        onEdit={() => setModalEvent(event)}
                        onDelete={() => setDeleteTarget(event)}
                        onToggle={() => handleToggle(event)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past */}
              {past.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
                    Eventos passados
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {past.map((event, i) => (
                      <EventAdminCard
                        key={event.id} event={event} index={i}
                        toggling={togglingId === event.id}
                        onEdit={() => setModalEvent(event)}
                        onDelete={() => setDeleteTarget(event)}
                        onToggle={() => handleToggle(event)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalEvent !== null && (
          <EventModal
            event={modalEvent === "new" ? undefined : modalEvent}
            onClose={() => setModalEvent(null)}
            onSaved={handleSaved}
          />
        )}
        {deleteTarget && (
          <DeleteConfirm
            event={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function EventAdminCard({ event, index, toggling, onEdit, onDelete, onToggle }: {
  event: Event; index: number; toggling: boolean;
  onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const upcoming = isUpcoming(event.date);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl border bg-[var(--color-bg-elevated)] overflow-hidden transition-all ${
        event.active ? "border-[var(--color-border)]" : "border-[var(--color-border)] opacity-60"
      }`}
    >
      {/* Image */}
      <div className="relative aspect-video bg-[var(--color-bg-overlay)]">
        {event.imageUrl ? (
          <Image src={event.imageUrl} alt={event.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-[var(--color-text-muted)]" />
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant={upcoming ? "success" : "secondary"} className="text-xs backdrop-blur-sm">
            {upcoming ? "Próximo" : "Encerrado"}
          </Badge>
          {!event.active && (
            <Badge variant="secondary" className="text-xs backdrop-blur-sm">Oculto</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-neon-blue)] font-medium mb-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(event.date)}
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1 line-clamp-1">
          {event.title}
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-4">
          {event.description}
        </p>

        <Separator className="mb-3" />

        <div className="flex items-center gap-2">
          {/* Toggle visibility */}
          <button onClick={onToggle} disabled={toggling}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              event.active
                ? "text-[var(--color-success)] bg-emerald-500/10 hover:bg-emerald-500/20"
                : "text-[var(--color-text-muted)] bg-[var(--color-bg-overlay)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            {toggling
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : event.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {event.active ? "Visível" : "Oculto"}
          </button>

          <div className="flex-1" />

          <button onClick={onEdit}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] transition-all"
            title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-all"
            title="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
