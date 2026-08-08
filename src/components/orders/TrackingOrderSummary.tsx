"use client";

import { MapPin, CreditCard, Calendar, Package, Store } from "lucide-react";
import { resolveOrderPayment } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/labels";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

function isPickup(o: Order) {
  const a = o.deliveryAddress;
  return !a || a.id === "pickup" || a.label === "Retirada na loja" || !a.street;
}

/** Resumo do pedido: itens, endereço, forma de pagamento e valor total. */
export function TrackingOrderSummary({ order }: { order: Order }) {
  const pay = resolveOrderPayment(order);
  const pickup = isPickup(order);

  return (
    <div className="glass rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-overlay)]/60">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Pedido #{order.id.slice(-8).toUpperCase()}
          </p>
          <span className="text-sm font-black text-[var(--color-neon-blue)]">
            {formatCurrency(order.total)}
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          Feito em {formatDateTime(order.createdAt)}
        </p>
      </div>

      {/* Itens */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5 mb-2">
          <Package className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Itens ({order.items.length})
          </p>
        </div>
        <div className="space-y-1.5">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
              <p className="text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-primary)] font-semibold">{item.quantity}×</span>{" "}
                {item.name}
                {item.color && <span className="text-[var(--color-text-muted)]"> · {item.color}</span>}
              </p>
              <span className="text-[var(--color-text-secondary)] whitespace-nowrap">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1 text-xs">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          {order.deliveryFee > 0 && !pickup && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Entrega</span>
              <span>{formatCurrency(order.deliveryFee)}</span>
            </div>
          )}
          {order.cardFee ? (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Taxa de cartão</span>
              <span>{formatCurrency(order.cardFee)}</span>
            </div>
          ) : null}
          {order.discount ? (
            <div className="flex justify-between text-[var(--color-success)]">
              <span>Desconto</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-bold text-[var(--color-text-primary)] text-sm pt-1">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Endereço + pagamento */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-start gap-2.5">
          {pickup ? (
            <Store className="w-4 h-4 text-[var(--color-neon-blue)] mt-0.5 shrink-0" />
          ) : (
            <MapPin className="w-4 h-4 text-[var(--color-neon-blue)] mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {pickup ? "Retirada na loja" : "Endereço de entrega"}
            </p>
            {pickup ? (
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                Cliente retira no balcão.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                {order.deliveryAddress.street}, {order.deliveryAddress.number}
                {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ""}<br />
                {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/{order.deliveryAddress.state}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <CreditCard className="w-4 h-4 text-[var(--color-neon-blue)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Pagamento
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              {PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
            </p>
          </div>
        </div>

        {order.notes && (
          <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-overlay)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 whitespace-pre-line">
            {order.notes}
          </p>
        )}
      </div>
    </div>
  );
}
