/** Formatos de texto compartidos por todas las pantallas. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** '$1,250' - para totales y ejes. */
export function money(value: number): string {
  return USD.format(value || 0)
}

/** '$1,250.00' - para el historial de fee, donde los centavos importan. */
export function moneyExact(value: number): string {
  return USD_CENTS.format(value || 0)
}

/** '+3' / '-1' / '0' */
export function signedPoints(value: number): string {
  if (value > 0) return '+' + value
  return String(value)
}

/** Iniciales para el avatar cuando todavia no hay foto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Porcentaje acotado a 0-100, para las barras de progreso de calificacion. */
export function progressPct(current: number, target: number): number {
  if (target <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
}

/** Convierte un nombre a un id kebab-case: 'ALEX FLORES' -> 'alex-flores'. */
export function toBrokerId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
