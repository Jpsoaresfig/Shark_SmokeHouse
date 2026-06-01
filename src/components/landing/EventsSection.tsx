"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getEvents } from "@/lib/firebase/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/types";

export function EventsSection() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents(true)
      .then((all) =>
        setEvents(
          all
            .filter((e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
            .slice(0, 3)
        )
      )
      .finally(() => setLoading(false));
  }, []);

  if (!loading && events.length === 0) return null;

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <div>
            <Badge variant="orange" className="mb-3">
              <CalendarDays className="w-3 h-3" />
              Agenda
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)]">
              Próximos
              <span className="text-neon"> Eventos</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Noites exclusivas que você não pode perder.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/events">
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
                <div className="skeleton aspect-video" />
                <div className="p-5 space-y-3">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cards */}
        {!loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => (
              <motion.article
                key={event.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
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
                      <CalendarDays className="w-10 h-10 text-[var(--color-text-muted)]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3">
                    <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2 border border-white/10">
                      <Calendar className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                      <span className="text-xs font-semibold text-white">{formatDate(event.date)}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2 line-clamp-1 group-hover:text-[var(--color-neon-blue)] transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
