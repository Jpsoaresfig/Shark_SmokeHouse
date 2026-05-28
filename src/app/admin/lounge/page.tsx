"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Users, Clock, Phone,
  CheckCircle, XCircle, AlertCircle, Flame, CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { LoungeBooking } from "@/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const mockBookings: LoungeBooking[] = [
  {
    id: "b001", name: "João Silva", whatsapp: "(11) 99123-4567",
    email: "joao@email.com", date: "2026-05-28", time: "20:00",
    guestCount: 2, notes: "Aniversário de namoro", status: "approved", createdAt: "2026-05-25T14:30:00Z",
  },
  {
    id: "b002", name: "Maria Souza", whatsapp: "(21) 98765-4321",
    date: "2026-05-28", time: "21:00", guestCount: 4,
    status: "pending", createdAt: "2026-05-26T09:15:00Z",
  },
  {
    id: "b003", name: "Pedro Alves", whatsapp: "(11) 97654-3210",
    email: "pedro@email.com", date: "2026-05-29", time: "19:00",
    guestCount: 3, notes: "Prefere essência de menta", status: "approved", createdAt: "2026-05-24T18:00:00Z",
  },
  {
    id: "b004", name: "Ana Costa", whatsapp: "(31) 91234-5678",
    date: "2026-05-29", time: "22:00", guestCount: 5,
    notes: "Grupo de amigos, mesa grande", status: "pending", createdAt: "2026-05-27T11:00:00Z",
  },
  {
    id: "b005", name: "Lucas Ferreira", whatsapp: "(51) 99876-5432",
    date: "2026-05-31", time: "20:00", guestCount: 2,
    status: "approved", createdAt: "2026-05-26T16:45:00Z",
  },
  {
    id: "b006", name: "Camila Rocha", whatsapp: "(11) 98888-7777",
    email: "camila@email.com", date: "2026-06-01", time: "18:00",
    guestCount: 1, status: "approved", createdAt: "2026-05-27T20:00:00Z",
  },
  {
    id: "b007", name: "Rafael Lima", whatsapp: "(21) 99000-1234",
    date: "2026-06-01", time: "21:00", guestCount: 6,
    notes: "Festa de formatura", status: "pending", createdAt: "2026-05-28T08:30:00Z",
  },
  {
    id: "b008", name: "Fernanda Dias", whatsapp: "(41) 97777-8888",
    date: "2026-06-03", time: "20:00", guestCount: 2,
    status: "cancelled", createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "b009", name: "Bruno Martins", whatsapp: "(11) 96666-5555",
    date: "2026-06-05", time: "19:00", guestCount: 3,
    status: "approved", createdAt: "2026-05-28T13:00:00Z",
  },
  {
    id: "b010", name: "Juliana Neves", whatsapp: "(85) 98888-1111",
    email: "ju@email.com", date: "2026-06-07", time: "22:00",
    guestCount: 4, notes: "Primeira vez no lounge", status: "pending", createdAt: "2026-05-28T15:30:00Z",
  },
];

const statusConfig = {
  pending:   { label: "Pendente",   variant: "warning" as const,     icon: AlertCircle },
  approved:  { label: "Confirmado", variant: "success" as const,     icon: CheckCircle },
  cancelled: { label: "Cancelado",  variant: "destructive" as const, icon: XCircle },
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { day: number; curr: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, curr: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, curr: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, curr: false });
  }
  return cells;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AdminLoungePage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  );

  const bookingsByDate = useMemo(() => {
    const map: Record<string, LoungeBooking[]> = {};
    for (const b of mockBookings) {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    }
    return map;
  }, []);

  const filteredBookings = selectedDate
    ? (bookingsByDate[selectedDate] ?? [])
    : mockBookings.filter((b) => b.status !== "cancelled");

  const calendarCells = getCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const totalGuests = filteredBookings
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + (b.guestCount ?? 1), 0);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black text-[var(--color-text-primary)] flex items-center gap-3">
              <CalendarDays className="w-7 h-7 text-[var(--color-neon-blue)]" />
              Agenda do Lounge
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              Agendamentos de narguilé — visão do calendário
            </p>
          </div>
          <Badge variant="premium">
            <Flame className="w-3 h-3" />
            Narguilé Lounge
          </Badge>
        </div>

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
                    className="w-8 h-8 rounded-lg hover:bg-[var(--color-bg-overlay)] flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <CardTitle className="text-base font-bold">
                    {MONTHS[viewMonth]} {viewYear}
                  </CardTitle>
                  <button
                    onClick={nextMonth}
                    className="w-8 h-8 rounded-lg hover:bg-[var(--color-bg-overlay)] flex items-center justify-center transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-2">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)] py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarCells.map((cell, i) => {
                    const dateStr = cell.curr
                      ? toDateStr(viewYear, viewMonth, cell.day)
                      : "";
                    const bookings = dateStr ? (bookingsByDate[dateStr] ?? []) : [];
                    const active = bookings.filter(b => b.status !== "cancelled");
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
                          setSelectedDate(prev => prev === dateStr ? null : dateStr);
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
                          <span className={`mt-0.5 w-1 h-1 rounded-full ${isSelected ? "bg-[var(--color-neon-blue)]" : "bg-[var(--color-neon-cyan)]"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-cyan)]" />
                    Com reservas
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
                    {filteredBookings.filter(b => b.status !== "cancelled").length}
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
                    : "Todos os agendamentos"
                  }
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
                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Nenhum agendamento nesta data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredBookings
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((booking, i) => {
                        const cfg = statusConfig[booking.status];
                        const StatusIcon = cfg.icon;
                        return (
                          <div key={booking.id}>
                            <div className="flex items-start gap-3 py-3">
                              {/* Avatar placeholder */}
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
                                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                    <Phone className="w-3 h-3" />
                                    {booking.whatsapp}
                                  </span>
                                </div>

                                {booking.notes && (
                                  <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">
                                    "{booking.notes}"
                                  </p>
                                )}
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
    </div>
  );
}
