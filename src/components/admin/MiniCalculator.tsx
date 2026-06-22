"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";

/** Arredonda evitando o ruído de ponto flutuante (0.1 + 0.2). */
function clean(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e10) / 1e10;
}

function compute(a: number, b: number, op: string): number {
  switch (op) {
    case "+": return clean(a + b);
    case "−": return clean(a - b);
    case "×": return clean(a * b);
    case "÷": return b === 0 ? NaN : clean(a / b);
    default: return b;
  }
}

/** Número → string para o visor (sem zeros à toa; vírgula no padrão BR). */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "Erro";
  return String(parseFloat(n.toFixed(8))).replace(".", ",");
}

/**
 * Mini calculadora flutuante — um mimo para a equipe do balcão. Botão circular
 * fixo no canto; abre um teclado simples. Lógica clássica de calculadora (sem
 * eval), pura no render.
 */
export function MiniCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0"); // string interna (usa ".")
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [error, setError] = useState(false);

  function reset() {
    setDisplay("0"); setPrev(null); setOp(null); setOverwrite(true); setError(false);
  }

  function inputDigit(d: string) {
    if (error) reset();
    if (overwrite) {
      setDisplay(d === "0" ? "0" : d);
      setOverwrite(false);
    } else {
      setDisplay((cur) => (cur === "0" ? d : cur.length < 12 ? cur + d : cur));
    }
  }

  function inputDot() {
    if (error) { reset(); setDisplay("0."); setOverwrite(false); return; }
    if (overwrite) { setDisplay("0."); setOverwrite(false); return; }
    setDisplay((cur) => (cur.includes(".") ? cur : cur + "."));
  }

  function chooseOp(nextOp: string) {
    if (error) return;
    const cur = parseFloat(display);
    if (prev !== null && op && !overwrite) {
      const res = compute(prev, cur, op);
      if (!Number.isFinite(res)) { setError(true); setDisplay("Erro"); return; }
      setPrev(res);
      setDisplay(fmt(res).replace(",", "."));
    } else {
      setPrev(cur);
    }
    setOp(nextOp);
    setOverwrite(true);
  }

  function equals() {
    if (error || prev === null || !op) return;
    const cur = parseFloat(display);
    const res = compute(prev, cur, op);
    if (!Number.isFinite(res)) { setError(true); setDisplay("Erro"); return; }
    setDisplay(fmt(res).replace(",", "."));
    setPrev(null);
    setOp(null);
    setOverwrite(true);
  }

  function backspace() {
    if (error) { reset(); return; }
    if (overwrite) return;
    setDisplay((cur) => {
      const next = cur.length <= 1 ? "0" : cur.slice(0, -1);
      if (next === "0" || next === "-") setOverwrite(true);
      return next === "" ? "0" : next;
    });
  }

  function percent() {
    if (error) return;
    setDisplay((cur) => fmt(clean(parseFloat(cur) / 100)).replace(",", "."));
    setOverwrite(true);
  }

  type Key = {
    label?: string;
    icon?: typeof Delete;
    fn: () => void;
    kind?: "op" | "accent" | "muted" | "num";
    span?: boolean;
  };
  const KEYS: Key[] = [
    { label: "C", fn: reset, kind: "muted" },
    { label: "%", fn: percent, kind: "muted" },
    { icon: Delete, fn: backspace, kind: "muted" },
    { label: "÷", fn: () => chooseOp("÷"), kind: "op" },
    { label: "7", fn: () => inputDigit("7"), kind: "num" },
    { label: "8", fn: () => inputDigit("8"), kind: "num" },
    { label: "9", fn: () => inputDigit("9"), kind: "num" },
    { label: "×", fn: () => chooseOp("×"), kind: "op" },
    { label: "4", fn: () => inputDigit("4"), kind: "num" },
    { label: "5", fn: () => inputDigit("5"), kind: "num" },
    { label: "6", fn: () => inputDigit("6"), kind: "num" },
    { label: "−", fn: () => chooseOp("−"), kind: "op" },
    { label: "1", fn: () => inputDigit("1"), kind: "num" },
    { label: "2", fn: () => inputDigit("2"), kind: "num" },
    { label: "3", fn: () => inputDigit("3"), kind: "num" },
    { label: "+", fn: () => chooseOp("+"), kind: "op" },
    { label: "0", fn: () => inputDigit("0"), kind: "num", span: true },
    { label: ",", fn: inputDot, kind: "num" },
    { label: "=", fn: equals, kind: "accent" },
  ];

  return (
    <div className="fixed z-40 right-4 md:right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="absolute bottom-16 right-0 w-60 rounded-2xl border border-[var(--color-border)] glass-strong p-3 shadow-xl"
          >
            {/* Visor */}
            <div className="mb-2 rounded-xl bg-[var(--color-bg-overlay)] px-3 py-2.5 text-right">
              <span className="text-[10px] text-[var(--color-text-muted)] block h-3">
                {prev !== null && op ? `${fmt(prev)} ${op}` : " "}
              </span>
              <span className={`text-2xl font-black tabular-nums break-all ${error ? "text-red-400" : "text-[var(--color-text-primary)]"}`}>
                {display.replace(".", ",")}
              </span>
            </div>

            {/* Teclado */}
            <div className="grid grid-cols-4 gap-1.5">
              {KEYS.map((k, i) => {
                const Icon = k.icon;
                return (
                  <button
                    key={(k.label ?? "icon") + i}
                    onClick={k.fn}
                    aria-label={k.icon ? "Apagar" : k.label}
                    className={`h-10 rounded-lg text-sm font-bold transition-all active:scale-95 flex items-center justify-center ${k.span ? "col-span-2" : ""} ${
                      k.kind === "accent"
                        ? "bg-[var(--color-neon-blue)] text-white hover:opacity-90"
                        : k.kind === "op"
                          ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)]/20"
                          : k.kind === "muted"
                            ? "bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            : "bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                    }`}
                  >
                    {Icon ? <Icon className="w-4 h-4" /> : k.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[10px] text-[var(--color-text-muted)]">🦈 calculadora rápida</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão circular */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-[var(--color-neon-blue)] text-white shadow-[var(--shadow-neon-sm)] flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label={open ? "Fechar calculadora" : "Abrir calculadora"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="w-6 h-6" /></motion.span>
            : <motion.span key="c" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><CalcIcon className="w-6 h-6" /></motion.span>}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
