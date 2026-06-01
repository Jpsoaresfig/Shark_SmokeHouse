"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getReviews } from "@/lib/firebase/reviews";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import type { Review } from "@/types";

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= value ? "text-[var(--color-warning)] fill-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`}
        />
      ))}
    </div>
  );
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await getReviews());
    } catch {
      toast.error("Não foi possível carregar as avaliações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length;
  }, [reviews]);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader
          title="Avaliações"
          subtitle={`${reviews.length} avaliação${reviews.length !== 1 ? "ões" : ""} de clientes`}
        />

        {/* Resumo */}
        {!loading && reviews.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-warning)]/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-[var(--color-warning)] fill-[var(--color-warning)]" />
                </div>
                <div>
                  <p className="text-xl font-black text-[var(--color-text-primary)]">{average.toFixed(1)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Nota média</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-[var(--color-neon-blue)]" />
                </div>
                <div>
                  <p className="text-xl font-black text-[var(--color-text-primary)]">{reviews.length}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total de avaliações</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Star className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">Nenhuma avaliação ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Stars value={r.rating} />
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{r.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span className="font-mono">#{r.orderId.slice(-6).toUpperCase()}</span>
                        <span>·</span>
                        <span>{r.createdAt ? formatDateTime(r.createdAt) : "—"}</span>
                      </div>
                    </div>
                    {r.comment ? (
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{r.comment}</p>
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)] italic">Sem comentário.</p>
                    )}
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
