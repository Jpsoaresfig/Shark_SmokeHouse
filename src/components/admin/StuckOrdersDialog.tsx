"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subscribeOrders } from "@/lib/firebase/orders";
import { hoursInStatus, isOrderStuck } from "@/lib/orderTracking";
import type { Order, OrderStatus } from "@/types";

/** Rótulos + variante do badge para os status que podem "prender". */
const STUCK_STATUS_META: Partial<Record<OrderStatus, { label: string; variant: "secondary" | "warning" | "purple" | "orange" }>> = {
  received:         { label: "Recebido",    variant: "secondary" },
  analyzing:        { label: "Em análise",  variant: "warning" },
  approved:         { label: "Aprovado",    variant: "purple" },
  preparing:        { label: "Preparando",  variant: "purple" },
  out_for_delivery: { label: "Em rota",     variant: "orange" },
};

/** Formata horas decimais para exibição ("4h 30min"). */
function formatStuckTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}min`;
}

/**
 * Popup do admin: pedidos há muito tempo num status sem serem concluídos
 * (entregues/cancelados). Abre sozinho quando há pedidos presos ainda não
 * reconhecidos e reaparece se um novo pedido ficar preso na sessão.
 */
export function StuckOrdersDialog() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  // Pedidos que o admin já viu/descartou nesta sessão (não reabre para os mesmos).
  const acknowledged = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeOrders(
      200,
      (list) => {
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error("[stuck orders subscribe]", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const stuck = useMemo(
    () => orders.filter((o) => isOrderStuck(o)),
    [orders],
  );

  // Abre quando existir algum pedido preso ainda não reconhecido.
  useEffect(() => {
    if (loading) return;
    const hasUnseen = stuck.some((o) => !acknowledged.current.has(o.id));
    if (hasUnseen) setOpen(true);
  }, [loading, stuck]);

  function handleClose() {
    for (const o of stuck) acknowledged.current.add(o.id);
    setOpen(false);
  }

  const sorted = useMemo(
    () =>
      [...stuck].sort(
        (a, b) =>
          hoursInStatus(b, b.status) - hoursInStatus(a, a.status),
      ),
    [stuck],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </span>
            Pedidos pendentes há muito tempo
          </DialogTitle>
          <DialogDescription>
            {sorted.length === 1
              ? "Há 1 pedido aguardando conclusão (entregue ou cancelado)."
              : `Há ${sorted.length} pedidos aguardando conclusão (entregue ou cancelado).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {sorted.map((o) => {
            const meta = STUCK_STATUS_META[o.status] ?? { label: o.status, variant: "warning" as const };
            const stuckHours = hoursInStatus(o, o.status);
            return (
              <a
                key={o.id}
                href={`/admin/orders?order=${o.id}`}
                onClick={handleClose}
                className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-3 hover:border-red-500/40 hover:bg-red-500/10 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                      #{o.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                    {o.customerName} · {formatStuckTime(stuckHours)} parado no status
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-neon-blue)] shrink-0 transition-colors" />
              </a>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            <Clock className="w-4 h-4" /> Entendi, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
