/**
 * Alertas de "pedido novo" no painel: som (Web Audio, sem arquivo de áudio) e
 * notificação do sistema operacional (Notification API). Tudo é best-effort —
 * se o navegador bloquear áudio/notificação, simplesmente não faz nada.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx ??= new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Navegadores só permitem tocar áudio após uma interação do usuário. Chame isto
 * no primeiro clique/toque do admin para "destravar" o contexto de áudio, assim
 * o som do próximo pedido novo toca sem bloqueio.
 */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

/** Toca um bip curto e agradável de "pedido novo" (duas notas ascendentes). */
export function playNewOrderChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch {
    /* navegador bloqueou o áudio — ignora */
  }
}

/** Pede permissão de notificação do sistema (só na primeira vez). */
export function requestNotificationPermission(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/** Mostra uma notificação do sistema operacional (mesmo com a aba em segundo plano). */
export function showSystemNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/logo_shark_preta.jpeg",
      tag: "shark-novo-pedido",
      renotify: true,
    } as NotificationOptions);
  } catch {
    /* ignora */
  }
}
