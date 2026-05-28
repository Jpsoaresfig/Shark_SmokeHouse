"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Users, Clock, Phone, Mail,
  CheckCircle, XCircle, AlertCircle, CalendarDays, RefreshCw,
  Trash2, MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  getLoungeBookings, updateLoungeBookingStatus, deleteLoungeBooking,
} from "@/lib/firebase/lounge";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { LoungeBooking, BookingStatus } from "@/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const statusConfig = {
  pending:   { label: "Pendente",   variant: "warning" as const,     icon: AlertCircle },
  approved:  { label: "Confirmado", variant: "success" as const,     icon: CheckCircle },
  cancelled: { label: "Cancelado",  variant: "destructive" as const, icon: XCircle    },
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: { day: number; curr: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, curr: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, curr: true });
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) cells.push({ day: d, curr: false });
  return cells;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function waLink(whatsapp: string, name: string, date: string, time: string) {
  const phone = whatsapp.replace(/\D/g, "");
  const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
  const [y, m, d] = date.split("-");
  const msg = encodeURIComponent(
    `Olá ${name}! Sua reserva no Shark Lounge para ${d}/${m}/${y} às ${time} está confirmada. Até lá! 🦈💨`
  );
  return `https://wa.me/${fullPhone}?text=${msg}`;
}

export default function AdminLoungePage() {
  const { firebaseReady } = useAuthStore();
  const today = new Date();
  const [viewYear, setViewYear]     = useState(today.getFullYear());
  const [viewMonth, setViewMonth]   = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [bookings, setBookings]     = useState<LoungeBooking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actionId, setActionId]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoungeBooking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await getLoungeBookings());
    } catch {
      toast.error("Não foi possível carregar as reservas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (firebaseReady) load(); }, [firebaseReady, load]);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, LoungeBooking[]> = {};
    for (const b of bookings) {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    }
    return map;
  }, [bookings]);

  const filteredBookings = selectedDate
    ? (bookingsByDate[selectedDate] ?? [])
    : bookings.filter((b) => b.status !== "cancelled");

  const calendarCells = getCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const totalGuests = filteredBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + (b.guestCount ?? 1), 0);

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  async function changeStatus(id: string, status: BookingStatus) {
    setActionId(id);
    try {
      await updateLoungeBookingStatus(id, status);
      setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
      toast.success(
        status === "approved" ? "Reserva confirmada!" :
        status === "cancelled" ? "Reserva cancelada." :
        "Status atualizado."
      );
    } catch {
      toast.error("Erro ao atualizar a reserva.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionId(deleteTarget.id);
    try {
      await deleteLoungeBooking(deleteTarget.id);
      setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      toast.success("Reserva excluída.");
      setDeleteTarget(null);
    } catch {
      toast.error("Erro ao excluir a reserva.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        <AdminPageHeader
          title="Agenda do Lounge"
          subtitle={
            loading
              ? "Carregando reservas..."
              : `${bookings.length} reserva${bookings.length !== 1 ? "s" : ""} · ${pendingCount} pendente${pendingCount !== 1 ? "s" : ""}`
          }
          action={
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          }
        />

        <div className="grid lg:grid-cols-5 gap-6 items-start">

          {/* Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="w-10 h-10 rounded-lg hover:bg-[var(--color-bg-overlay)] flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-base font-bold">
                    {MONTHS[viewMonth]} {viewYear}
                  </CardTitle>
                  <button
                    onClick={nextMonth}
                    className="w-10 h-10 rounded-lg hover:bg-[var(--color-bg-overlay)] flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    aria-label="Próximo mês"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="grid grid-cols-7 mb-2 min-w-[280px]">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)] py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 min-w-[280px]">
                    {calendarCells.map((cell, i) => {
                      const dateStr = cell.curr ? toDateStr(viewYear, viewMonth, cell.day) : "";
                      const dayBookings = dateStr ? (bookingsByDate[dateStr] ?? []) : [];
                      const active = dayBookings.filter((b) => b.status !== "cancelled");
                      const hasPending = dayBookings.some((b) => b.status === "pending");
                      const isToday =
                        cell.curr &&
                        cell.day === today.getDate() &&
                        viewMonth === today.getMonth() &&
                        viewYear === today.getFullYear();
                      const isSelected = dateStr === selectedDate && cell.curr;

                      return (
                        <button
                          key={i}
                          disabled={!cell.curr}
                          onClick={() => {
                            if (!cell.curr) return;
                            setSelectedDate((prev) => prev === dateStr ? null : dateStr);
                          }}
                          className={`
                            relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-lg h-10 text-xs font-medium transition-all
                            ${!cell.curr ? "opacity-25 cursor-default" : "cursor-pointer"}
                            ${isSelected
                              ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/40"
                              : isToday
                              ? "border border-[var(--color-neon-blue)]/30 text-[var(--color-neon-blue)]"
                              : cell.curr
                              ? "hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]"
                              : "text-[var(--color-text-muted)]"
                            }
                          `}
                        >
                          <span>{cell.day}</span>
                          {active.length > 0 && (
                            <span className={`mt-0.5 w-1 h-1 rounded-full ${
                              hasPending ? "bg-[var(--color-warning)]"
                              : isSelected ? "bg-[var(--color-neon-blue)]"
                              : "bg-[var(--color-neon-cyan)]"
                            }`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--color-border)] flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-cyan)]" />
                    Confirmadas
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                    Pendentes
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <span className="w-3 h-3 rounded border border-[var(--color-neon-blue)]/30 inline-block" />
                    Hoje
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-4 grid grid-cols-2 gap-3"
            >
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selectedDate ? "Reservas no dia" : "Total ativas"}
                  </p>
                  <p className="text-2xl font-black text-[var(--color-neon-blue)]">
                    {filteredBookings.filter((b) => b.status !== "cancelled").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col gap-1">
                  <p className="text-xs text-[var(--color-text-muted)]">Pessoas esperadas</p>
                  <p className="text-2xl font-black text-emerald-400">{totalGuests}</p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Booking list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3"
          >
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-0">
                <CardTitle className="text-base">
                  {selectedDate
                    ? (() => {
                        const [y, m, d] = selectedDate.split("-");
                        return `${d}/${m}/${y}`;
                      })()
                    : "Todos os agendamentos"}
                </CardTitle>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Ver todos
                  </button>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="skeleton h-20 rounded-xl" />
                    ))}
                  </div>
                ) : filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {selectedDate
                        ? "Nenhum agendamento nesta data"
                        : "Nenhuma reserva cadastrada ainda"}
                    </p>
                    {!selectedDate && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        Reservas feitas pelos clientes aparecerão aqui.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredBookings
                      .slice()
                      .sort((a, b) => {
                        if (selectedDate) return a.time.localeCompare(b.time);
                        const da = `${a.date} ${a.time}`;
                        const db = `${b.date} ${b.time}`;
                        return da.localeCompare(db);
                      })
                      .map((booking, i) => {
                        const cfg = statusConfig[booking.status];
                        const StatusIcon = cfg.icon;
                        const isUpdating = actionId === booking.id;
                        return (
                          <div key={booking.id}>
                            <div className="flex items-start gap-3 py-3">
                              <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-sm font-bold text-[var(--color-neon-blue)]">
                                  {booking.name.charAt(0).toUpperCase()}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {booking.name}
                                  </span>
                                  <Badge variant={cfg.variant} className="text-xs">
                                    <StatusIcon className="w-3 h-3" />
                                    {cfg.label}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                    <Clock className="w-3 h-3" />
                                    {booking.time}
                                    {!selectedDate && (
                                      <span className="ml-1 text-[var(--color-text-muted)]">
                                        · {booking.date.split("-").reverse().join("/")}
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                    <Users className="w-3 h-3" />
                                    {booking.guestCount ?? 1} pessoa{(booking.guestCount ?? 1) > 1 ? "s" : ""}
                                  </span>
                                  <a
                                    href={`tel:${booking.whatsapp.replace(/\D/g, "")}`}
                                    className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors"
                                  >
                                    <Phone className="w-3 h-3" />
                                    {booking.whatsapp}
                                  </a>
                                  {booking.email && (
                                    <a
                                      href={`mailto:${booking.email}`}
                                      className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors truncate max-w-[200px]"
                                    >
                                      <Mail className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{booking.email}</span>
                                    </a>
                                  )}
                                </div>

                                {booking.notes && (
                                  <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">
                                    &quot;{booking.notes}&quot;
                                  </p>
                                )}

                                {/* Action row */}
                                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                  {booking.status === "pending" && (
                                    <button
                                      disabled={isUpdating}
                                      onClick={() => changeStatus(booking.id, "approved")}
                                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-3 h-3" /> Confirmar
                                    </button>
                                  )}
                                  {booking.status !== "cancelled" && (
                                    <button
                                      disabled={isUpdating}
                                      onClick={() => changeStatus(booking.id, "cancelled")}
                                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 text-xs font-medium text-[var(--color-error)] hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                    >
                                      <XCircle className="w-3 h-3" /> Cancelar
                                    </button>
                                  )}
                                  {booking.status === "cancelled" && (
                                    <button
                                      disabled={isUpdating}
                                      onClick={() => changeStatus(booking.id, "pending")}
                                      className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-xs font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 transition-colors disabled:opacity-50"
                                    >
                                      <RefreshCw className="w-3 h-3" /> Reabrir
                                    </button>
                                  )}
                                  <a
                                    href={waLink(booking.whatsapp, booking.name, booking.date, booking.time)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                  </a>
                                  <button
                                    disabled={isUpdating}
                                    onClick={() => setDeleteTarget(booking)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors disabled:opacity-50 ml-auto"
                                    aria-label="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            {i < filteredBookings.length - 1 && <Separator />}
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir reserva</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a reserva de <strong>{deleteTarget?.name}</strong> para{" "}
              {deleteTarget && deleteTarget.date.split("-").reverse().join("/")} às {deleteTarget?.time}?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              variant="default"
              className="bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={handleDelete}
              disabled={!!actionId}
            >
              {actionId
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
