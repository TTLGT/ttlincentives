/**
 * Todo el manejo de fechas del sitio.
 *
 * Guatemala es UTC-6 fijo y no tiene horario de verano, asi que la fecha local
 * se obtiene desplazando el instante UTC seis horas hacia atras. Eso evita
 * depender de la zona horaria del navegador (un broker viendo el sitio desde
 * otro pais debe ver exactamente el mismo dia que la oficina).
 */

import { TIMEZONE_OFFSET_HOURS, DAILY_CUTOFF_HOUR } from '../config/competition'

const MS_PER_DAY = 86_400_000
const OFFSET_MS = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000

/** Fecha 'YYYY-MM-DD' en hora de Guatemala para un instante dado. */
export function toGuatemalaDate(instant: Date = new Date()): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

/** Hora del dia (0-23) en Guatemala para un instante dado. */
export function guatemalaHour(instant: Date = new Date()): number {
  return new Date(instant.getTime() + OFFSET_MS).getUTCHours()
}

/** El dia de hoy en Guatemala. */
export function today(): string {
  return toGuatemalaDate()
}

/** Convierte 'YYYY-MM-DD' (hora de Guatemala) al instante UTC de medianoche de ese dia. */
export function dateToInstant(date: string, hour = 0): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour - TIMEZONE_OFFSET_HOURS))
}

/** El instante exacto del corte de las 3:00 PM de Guatemala para un dia dado. */
export function cutoffInstant(date: string): Date {
  return dateToInstant(date, DAILY_CUTOFF_HOUR)
}

/** Suma dias a una fecha 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  return new Date(dateToInstant(date).getTime() + days * MS_PER_DAY + OFFSET_MS)
    .toISOString()
    .slice(0, 10)
}

/** Diferencia en dias entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateToInstant(b).getTime() - dateToInstant(a).getTime()) / MS_PER_DAY)
}

/** Lista inclusiva de fechas de `start` a `end`. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  const total = daysBetween(start, end)
  for (let i = 0; i <= total; i++) out.push(addDays(start, i))
  return out
}

/** `date` esta dentro de [start, end] inclusive. Comparacion lexicografica de ISO. */
export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

/** Clampa una fecha al rango dado. */
export function clampDate(date: string, start: string, end: string): string {
  if (date < start) return start
  if (date > end) return end
  return date
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** '16 sep' - etiqueta corta para ejes de graficas. */
export function shortLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`
}

/** 'miercoles 16 de septiembre de 2026' - etiqueta larga. */
export function longLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${weekday} ${d} de ${MONTH_NAMES[m - 1]} de ${y}`
}

/** Numero de semana de la competencia (1, 2, ...) para una fecha. */
export function weekIndex(date: string, competitionStart: string): number {
  return Math.floor(daysBetween(competitionStart, date) / 7) + 1
}

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  finished: boolean
}

/** Cuenta regresiva desde ahora hasta un instante. */
export function countdownTo(target: Date, from: Date = new Date()): Countdown {
  let diff = Math.floor((target.getTime() - from.getTime()) / 1000)
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true }
  const days = Math.floor(diff / 86400)
  diff -= days * 86400
  const hours = Math.floor(diff / 3600)
  diff -= hours * 3600
  const minutes = Math.floor(diff / 60)
  return { days, hours, minutes, seconds: diff - minutes * 60, finished: false }
}
