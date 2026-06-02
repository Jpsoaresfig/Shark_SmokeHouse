"use client";

import { useEffect, useRef } from "react";

interface BarcodeScannerOptions {
  /** Intervalo máximo (ms) entre teclas para considerar entrada de leitor.
   *  Leitores "digitam" muito rápido (<40ms); humanos são bem mais lentos. */
  maxGapMs?: number;
  /** Tamanho mínimo do código para emitir (evita falso positivo de digitação). */
  minLength?: number;
  /** Liga/desliga a captura (ex.: só na aba de venda). */
  enabled?: boolean;
}

/**
 * Captura a leitura de um leitor de código de barras (modo "teclado HID").
 *
 * O leitor envia os dígitos em rajada e finaliza com Enter. Em vez de deixar
 * esses eventos caírem num input controlado — o que, com hardware mal
 * configurado, pode encher o campo (ex.: "7777…") e travar a tela —, este hook
 * escuta o teclado globalmente, junta só as teclas que chegam em rajada e
 * emite o código UMA vez, no Enter. Digitação humana (pausas longas) zera o
 * buffer e nunca dispara, então não interfere na busca manual nem em textareas.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  { maxGapMs = 40, minLength = 4, enabled = true }: BarcodeScannerOptions = {},
) {
  const buffer = useRef("");
  const lastTime = useRef(0);
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      const gap = now - lastTime.current;
      lastTime.current = now;

      // Pausa longa entre teclas = digitação humana → recomeça o buffer.
      if (gap > maxGapMs) buffer.current = "";

      if (e.key === "Enter") {
        const code = buffer.current.trim();
        buffer.current = "";
        // Só trata como leitura se veio um código completo em rajada.
        if (code.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(code);
        }
        return;
      }

      // Acumula apenas caracteres únicos (dígitos/letras), ignora Shift, etc.
      if (e.key.length === 1) buffer.current += e.key;
    }

    // Captura na fase de captura para interceptar antes de qualquer input.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, maxGapMs, minLength]);
}
