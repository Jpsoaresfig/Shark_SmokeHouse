"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { subscribeOrdersByCustomer } from "@/lib/firebase/orders";
import { toast } from "@/stores/toastStore";
import type { Order, OrderStatus } from "@/types";

const isActive = (s: OrderStatus) => s !== "delivered" && s !== "cancelled";

/** Mensagem curta de toast quando o status de um pedido do cliente muda. */
const STATUS_MSG: Record<OrderStatus, string> = {
  received:         "Pedido recebido ✅",
  analyzing:        "Seu pedido está em análise",
  approved:         "Pedido aprovado! 🎉",
  preparing:        "Seu pedido está sendo preparado 📦",
  out_for_delivery: "Saiu para entrega! 🛵",
  delivered:        "Pedido entregue — aproveite! 🦈",
  cancelled:        "Pedido cancelado",
};

/**
 * Botão (ao lado do carrinho) que mostra, em tempo real, quantos pedidos o
 * cliente tem em andamento — com uma bolinha pulsando — e leva direto ao
 * acompanhamento. Some quando não há pedido ativo. Também avisa por toast
 * sempre que o status de um pedido muda, sem precisar entrar na página.
 */
export function MyOrdersButton() {
  const { user, firebaseReady } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const prevStatus = useRef<Record<string, OrderStatus>>({});
  const seeded = useRef(false);

  useEffect(() => {
    // Só clientes têm "meus pedidos"; admin/seller usam o painel. Sem cliente
    // o componente já renderiza null, então basta resetar os refs de controle.
    if (!firebaseReady || !user || user.role !== "customer") {
      prevStatus.current = {};
      seeded.current = false;
      return;
    }

    const unsub = subscribeOrdersByCustomer(user.uid, (list) => {
      // Após a primeira carga, avisa quando o status de algum pedido muda.
      if (seeded.current) {
        for (const o of list) {
          const prev = prevStatus.current[o.id];
          if (prev && prev !== o.status) {
            const ref = `#${o.id.slice(-6).toUpperCase()}`;
            toast.info(`${STATUS_MSG[o.status]} — pedido ${ref}`, "Atualização do pedido");
          }
        }
      }
      prevStatus.current = Object.fromEntries(list.map(o => [o.id, o.status]));
      seeded.current = true;
      setOrders(list);
    });

    return () => unsub();
  }, [firebaseReady, user]);

  const activeCount = orders.filter(o => isActive(o.status)).length;
  if (!user || user.role !== "customer" || activeCount === 0) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      asChild
      aria-label={`${activeCount} pedido${activeCount !== 1 ? "s" : ""} em andamento`}
      title="Acompanhar meus pedidos"
    >
      <Link href="/orders">
        <Package className="w-5 h-5" />
        {/* Bolinha pulsando com a contagem de pedidos ativos */}
        <span className="absolute -top-0.5 -right-0.5 flex">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-neon-blue)] opacity-75 animate-ping" />
          <span className="relative min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] text-[10px] font-bold flex items-center justify-center shadow-[var(--shadow-neon-sm)]">
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        </span>
      </Link>
    </Button>
  );
}
