/**
 * Utilidades de CPF (Task 2.1) — módulo puro e testável.
 *
 * O CPF é OPCIONAL no cadastro/checkout, mas quando preenchido deve ser válido
 * estruturalmente (dígitos verificadores) antes de gravar no banco. É a chave de
 * identificação do Clube Shark para acúmulo/resgate de pontos.
 */

/** Mantém apenas os dígitos (remove pontos, traços e espaços). */
export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Valida um CPF pelo algoritmo dos dígitos verificadores.
 * Aceita com ou sem máscara. Rejeita strings com tamanho ≠ 11 e sequências de
 * dígitos repetidos (000.000.000-00, 111…), que passam na conta mas são inválidas.
 */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

/** Formata para exibição: 000.000.000-00 (preserva entrada parcial). */
export function formatCpf(value: string): string {
  const cpf = onlyDigits(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
