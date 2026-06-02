"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, CheckCircle, Flame, ArrowRight, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createLoungeBooking, getTakenSlots, SLOT_TAKEN } from "@/lib/firebase/lounge";
import { useSiteSettingsStore, useSiteSections } from "@/stores/siteSettingsStore";
import { toast } from "@/stores/toastStore";

const timeSlots = [
  "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00", "23:00",
];

const features = [
  { icon: "🎵", title: "Música ao Vivo", desc: "Sex & Sáb das 20h às 01h" },
  { icon: "🥃", title: "Carta de Bebidas", desc: "Whisky, Gin, Drinks exclusivos" },
  { icon: "💨", title: "50+ Essências", desc: "Nacionais e importadas" },
  { icon: "🛋️", title: "Ambiente Climatizado", desc: "Conforto e sofisticação" },
];

export default function LoungePage() {
  const sections = useSiteSections();
  const settingsLoaded = useSiteSettingsStore((s) => s.loaded);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", whatsapp: "", email: "", date: "", guests: "1", notes: "",
  });

  // Ao escolher a data, busca os horários já reservados para desabilitá-los.
  useEffect(() => {
    if (!form.date) { setTakenSlots([]); return; }
    let active = true;
    getTakenSlots(form.date)
      .then((taken) => { if (active) setTakenSlots(taken); })
      .catch(() => { if (active) setTakenSlots([]); });
    return () => { active = false; };
  }, [form.date]);

  // Se o horário selecionado ficou ocupado (ex.: outra reserva), limpa a seleção.
  useEffect(() => {
    if (selectedTime && takenSlots.includes(selectedTime)) setSelectedTime("");
  }, [takenSlots, selectedTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) return;
    setLoading(true);
    try {
      await createLoungeBooking({
        name: form.name.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim() || undefined,
        date: form.date,
        time: selectedTime,
        guestCount: Number(form.guests),
        notes: form.notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("[lounge] createLoungeBooking", err);
      if (err instanceof Error && err.message === SLOT_TAKEN) {
        toast.error("Esse horário acabou de ser reservado. Escolha outro, por favor.");
        setSelectedTime("");
        getTakenSlots(form.date).then(setTakenSlots).catch(() => {});
      } else if (err instanceof Error && err.message && !err.message.includes("Firebase")) {
        // Mensagens de validação (data passada, campos obrigatórios) já vêm prontas.
        toast.error(err.message);
      } else {
        toast.error("Não foi possível enviar sua reserva. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!settingsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="w-8 h-8 border-2 border-[var(--color-neon-blue)]/30 border-t-[var(--color-neon-blue)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!sections.lounge) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-[var(--color-bg-overlay)] border-2 border-[var(--color-border)] flex items-center justify-center mx-auto mb-6">
            <CalendarOff className="w-10 h-10 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-3xl font-black text-[var(--color-text-primary)] mb-3">Agendamento indisponível</h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            As reservas do Lounge estão temporariamente desativadas. Volte em breve ou fale com a gente para mais informações.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">Voltar ao início</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-[var(--color-success)]/10 border-2 border-[var(--color-success)]/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[var(--color-success)]" />
          </div>
          <h2 className="text-3xl font-black text-[var(--color-text-primary)] mb-3">Pedido Enviado!</h2>
          <p className="text-[var(--color-text-secondary)] mb-2">
            Sua solicitação de reserva foi recebida com sucesso.
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mb-8">
            Nossa equipe entrará em contato pelo WhatsApp para confirmar sua reserva em até <strong className="text-[var(--color-text-secondary)]">30 minutos</strong>.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", whatsapp: "", email: "", date: "", guests: "1", notes: "" }); setSelectedTime(""); }}>
            Fazer outra reserva
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge variant="premium" className="mb-4">
            <Flame className="w-3 h-3" />
            Experiência Premium
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-black text-[var(--color-text-primary)] mb-4">
            Narguilé
            <span className="text-neon"> Lounge</span>
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Reserve sua mesa e mergulhe em uma experiência sensorial única. Ambiente exclusivo para os apreciadores do bom gosto.
          </p>
        </motion.div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl border border-[var(--color-border)] p-5 text-center"
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{f.title}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Booking form */}
        <div className="grid lg:grid-cols-5 gap-10 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="glass rounded-2xl border border-[var(--color-border)] p-8">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-6">Fazer Reserva</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Nome completo" placeholder="João Silva" required
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Input label="WhatsApp" placeholder="(83) 99999-9999" required
                    value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
                <Input label="E-mail (opcional)" type="email" placeholder="seu@email.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Data" type="date" required
                    value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                      Número de pessoas
                    </label>
                    <select
                      value={form.guests}
                      onChange={(e) => setForm({ ...form, guests: e.target.value })}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
                    >
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <option key={n} value={n}>{n} pessoa{n > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time slots */}
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] mb-2 block">
                    Horário
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {timeSlots.map((t) => {
                      const taken = takenSlots.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={taken}
                          onClick={() => setSelectedTime(t)}
                          title={taken ? "Horário já reservado" : undefined}
                          className={`h-11 rounded-lg text-sm font-medium transition-all ${
                            taken
                              ? "border border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-overlay)] line-through opacity-50 cursor-not-allowed"
                              : selectedTime === t
                                ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-neon-sm)]"
                                : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon-blue)] hover:text-[var(--color-neon-blue)] bg-[var(--color-bg-overlay)]"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {!selectedTime && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                      {form.date ? "Selecione um horário" : "Escolha a data para ver os horários disponíveis"}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Aniversário, preferências de essência, etc."
                    rows={3}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  variant="premium"
                  size="lg"
                  className="w-full"
                  disabled={loading || !selectedTime}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Confirmar Reserva
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Info sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="glass rounded-2xl border border-[var(--color-border)] p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--color-neon-blue)]" />
                Horário de Funcionamento
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  { days: "Segunda-Feira", hours: "Fechado", closed: true },
                  { days: "Terça a Quinta", hours: "14h às 00h", closed: false },
                  { days: "Sexta-Feira", hours: "14h às 02h", closed: false },
                  { days: "Sábado", hours: "12h às 02h", closed: false },
                  { days: "Domingo", hours: "12h às 23h", closed: false },
                ].map((item) => (
                  <div key={item.days} className="flex justify-between items-center">
                    <span className="text-[var(--color-text-secondary)]">{item.days}</span>
                    <span className={item.closed ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)] font-medium"}>
                      {item.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl border border-[var(--color-border)] p-6">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Política de Reservas
              </h3>
              <ul className="space-y-2 text-xs text-[var(--color-text-muted)]">
                <li>• Reservas confirmadas via WhatsApp em até 30min</li>
                <li>• Cancele com até 2h de antecedência</li>
                <li>• Mesa garantida por 30min após horário marcado</li>
                <li>• Consumação mínima por pessoa</li>
                <li>• Reservas para grupos acima de 8 pessoas, entre em contato diretamente</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
