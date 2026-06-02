/** Data de hoje no fuso local, no formato YYYY-MM-DD (mesmo do <input type="date">). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Id determinístico do slot de horário, usado como chave da coleção pública
 * `lounge_slots` (sem PII) que trava a reserva. Ex.: ("2026-06-15", "20:00")
 * → "2026-06-15_2000".
 */
export function slotId(date: string, time: string): string {
  return `${date}_${time.replace(/:/g, "")}`;
}

/** Datas ISO (YYYY-MM-DD) ordenam cronologicamente, então basta comparar strings. */
export function isPastDate(date: string, today: string = todayISO()): boolean {
  return date < today;
}

export interface BookingInput {
  name: string;
  whatsapp: string;
  date: string;
  time: string;
}

/**
 * Valida os campos obrigatórios da reserva e bloqueia data no passado.
 * Retorna a mensagem de erro, ou `null` quando está tudo certo. Serve tanto na
 * UI quanto antes de gravar (defesa no servidor, já que o `min` do input é só
 * do navegador).
 */
export function validateBooking(input: BookingInput, today: string = todayISO()): string | null {
  if (!input.name.trim()) return "Informe seu nome.";
  if (!input.whatsapp.trim()) return "Informe seu WhatsApp.";
  if (!input.date) return "Selecione uma data.";
  if (!input.time) return "Selecione um horário.";
  if (isPastDate(input.date, today)) return "A data escolhida já passou. Escolha uma data futura.";
  return null;
}
