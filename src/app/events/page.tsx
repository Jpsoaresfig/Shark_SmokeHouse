"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { getEvents } from "@/lib/firebase/events";
import { EventsGrid } from "@/components/events/EventsGrid";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/types";

function EventsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
          <div className="skeleton aspect-video" />
          <div className="p-5 space-y-3">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EventsPage() {
  const [upcoming, setUpcoming] = useState<Event[]>([]);
  const [past, setPast] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents(true).then((events) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setUpcoming(events.filter((e) => new Date(e.date) >= today));
      setPast(events.filter((e) => new Date(e.date) < today));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-20">
      {/* Hero */}
      <div className="relative px-4 sm:px-6 lg:px-8 py-16 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-surface)] to-[var(--color-bg-base)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, var(--color-neon-blue) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <Badge variant="premium" className="mb-4">
            <CalendarDays className="w-3 h-3" />
            Agenda Premium
          </Badge>
          <h1 className="text-5xl sm:text-6xl font-black text-[var(--color-text-primary)] mb-4">
            Nossos
            <span className="text-neon"> Eventos</span>
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)]">
            Noites exclusivas, experiências únicas. Marque na agenda e faça parte dos momentos mais especiais da Shark SmokeHouse.
          </p>
        </div>
      </div>

      {/* Events */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? <EventsSkeleton /> : <EventsGrid upcoming={upcoming} past={past} />}
        </div>
      </div>
    </div>
  );
}
