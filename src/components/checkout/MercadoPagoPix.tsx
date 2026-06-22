"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Wallet, Loader2, Copy, Check, CheckCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/stores/toastStore";

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
}

/**
 * Cobrança PIX do Mercado Pago exibida inline: gera um QR Code já com o valor
 * embutido (sem redirecionar nem mostrar telefone) e fica observando o status do
 * pedido até a confirmação automática (via webhook do MP).
 */
export function MercadoPagoPix({
  orderId,
  amount,
  onPaid,
}: {
  orderId: string;
  amount: number;
  onPaid?: () => void;
}) {
  const { user } = useAuthStore();
  const [pix, setPix] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paid, setPaid] = useState(false);
  // Incrementado pelo botão "tentar novamente" para refazer a cobrança.
  const [reloadKey, setReloadKey] = useState(0);

  // Mantém o callback mais recente sem reiniciar o polling a cada render.
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  // Gera a cobrança PIX ao montar (e a cada retry). Os setState só acontecem
  // depois do await, nunca de forma síncrona dentro do effect.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/payments/mercadopago/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            payerEmail: user?.email,
            payerCpf: user?.cpf,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !data?.qrCode) {
          setError(data?.error ?? "Não foi possível gerar o PIX. Tente novamente.");
          return;
        }
        setPix({
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          ticketUrl: data.ticketUrl,
        });
      } catch (err) {
        console.error("[mercadopago-pix] create", err);
        if (active) setError("Não foi possível gerar o PIX. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId, user, reloadKey]);

  // Enquanto o PIX está aberto e não pago, consulta o status a cada 4s.
  useEffect(() => {
    if (!pix || paid) return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/mercadopago/status?orderId=${encodeURIComponent(orderId)}`,
        );
        const data = await res.json().catch(() => null);
        if (active && data?.status === "paid") {
          setPaid(true);
          onPaidRef.current?.();
        }
      } catch {
        /* ignora — tenta de novo no próximo tick */
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pix, paid, orderId]);

  const retry = () => {
    setError(null);
    setPix(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const copy = async () => {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (paid) {
    return (
      <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-5 text-center">
        <CheckCircle className="w-8 h-8 text-[var(--color-success)] mx-auto mb-2" />
        <p className="text-sm font-bold text-[var(--color-success)]">Pagamento confirmado!</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Seu pedido já foi liberado e está sendo preparado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]/20 p-5 text-left">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-[var(--color-neon-blue)]" />
        <span className="text-sm font-bold text-[var(--color-neon-blue)]">Pague com PIX</span>
      </div>

      {/* Valor a pagar */}
      <div className="flex items-center justify-between gap-2 p-3 mb-4 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Valor a pagar</span>
        <span className="text-xl font-black text-[var(--color-neon-blue)]">{formatCurrency(amount)}</span>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-2 py-6 text-[var(--color-text-muted)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs">Gerando seu QR Code PIX…</span>
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-2">
          <p className="text-xs text-[var(--color-error)] mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      )}

      {!loading && !error && pix && (
        <>
          {/* QR Code */}
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-white">
              <QRCodeSVG value={pix.qrCode} size={200} marginSize={0} />
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] text-center mb-3">
            Abra o app do seu banco, escolha pagar com PIX por QR Code e aponte a câmera —
            o valor já vem preenchido.
          </p>

          {/* PIX copia e cola */}
          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
            Ou use o PIX copia e cola:
          </p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
            <span className="flex-1 text-xs font-mono text-[var(--color-text-primary)] truncate">
              {pix.qrCode}
            </span>
            <button
              onClick={copy}
              className="shrink-0 p-1.5 rounded-lg bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)] hover:text-[var(--color-bg-base)] transition-all"
              aria-label="Copiar código PIX"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Aguardando confirmação */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Aguardando o pagamento… a confirmação é automática.
          </div>

          {pix.ticketUrl && (
            <a
              href={pix.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full mt-3 text-[11px] font-medium text-[var(--color-neon-blue)] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir no Mercado Pago
            </a>
          )}
        </>
      )}
    </div>
  );
}
