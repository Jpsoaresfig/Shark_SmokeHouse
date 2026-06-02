"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CalendarDays, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/types";

function EventCard({ event, index }: { event: Event; index: number }) {
  const isUpcoming = new Date(event.date) >= new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden hover:border-[var(--color-neon-blue)] hover:shadow-[var(--shadow-neon-sm)] transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-video bg-[var(--color-bg-overlay)] overflow-hidden">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CalendarDays className="w-12 h-12 text-[var(--color-text-muted)]" />
          </div>
        )}
        {/* Dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Date chip floating on image */}
        <div className="absolute bottom-3 left-3">
          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2 border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
            <span className="text-xs font-semibold text-white">{formatDate(event.date)}</span>
          </div>
        </div>

        {/* Status */}
        <div className="absolute top-3 right-3">
          <Badge variant={isUpcoming ? "success" : "secondary"} className="text-xs backdrop-blur-sm">
            {isUpcoming ? "Em breve" : "Encerrado"}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2 line-clamp-2 group-hover:text-[var(--color-neon-blue)] transition-colors">
          {event.title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3 mb-4 leading-relaxed">
          {event.description}
        </p>

        {isUpcoming && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/lounge">
              Reservar Mesa
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </motion.article>
  );
}

interface Props {
  upcoming: Event[];
  past: Event[];
}

export function EventsGrid({ upcoming, past }: Props) {
  const [showPast, setShowPast] = useState(false);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-[var(--color-text-secondary)] font-medium">Nenhum evento por enquanto</p>
        <p className="text-sm text-[var(--color-text-muted)]">Volte em breve para novidades</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] shadow-[0_0_8px_var(--color-success)]" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Próximos Eventos</h2>
            <span className="text-sm text-[var(--color-text-muted)]">({upcoming.length})</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)]" />
              <h2 className="text-lg font-bold text-[var(--color-text-secondary)]">Eventos Anteriores</h2>
              <span className="text-sm text-[var(--color-text-muted)]">({past.length})</span>
            </div>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-sm text-[var(--color-neon-blue)] hover:underline"
            >
              {showPast ? "Ocultar" : "Ver todos"}
            </button>
          </div>

          {showPast && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
