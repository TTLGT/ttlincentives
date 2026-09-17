/**
 * FUENTE UNICA DE VERDAD DEL PUNTAJE.
 *
 * Toda pantalla y toda grafica del sitio saca sus numeros de este archivo.
 * El conteo de la Fase 1 y los puntos de la Fase 2 salen de aqui.
 *
 * Regla que no se rompe: SOLO las entradas con status 'approved' puntean.
 * Las 'pending' y las 'rejected' valen cero en todo calculo.
 */

import type { Broker, Entry, EntryKind } from '../types'
import {
  BONUS_POINTS_COUNT_IN_PHASE1,
  BIG_FISH_END,
  BIG_FISH_MIN_FEE,
  BIG_FISH_START,
  COMPETITION_END,
  COMPETITION_START,
  PHASE1_END,
  PHASE1_START,
  PHASE2_END,
  PHASE2_START,
  QUALIFY_FEE_FLOOR,
  QUALIFY_LOADS_PER_DAY,
} from '../config/competition'
import { addDays, clampDate, cutoffInstant, daysBetween, isWithin, today, weekIndex } from './dates'

// ---------------------------------------------------------------------------
// Tabla de puntos
// ---------------------------------------------------------------------------

/** Puntos por defecto de cada tipo. En el panel de admin quedan editables. */
export const POINTS_BY_KIND: Record<EntryKind, number> = {
  opportunity: 1,
  first_close: 3,
  extra_quote: 1,
  reactivated_or_referral: 5,
  cold_call_quote: 2,
  cold_call_close: 5,
  big_fish: 2,
  adjustment: 0,
}

export const KIND_LABELS: Record<EntryKind, string> = {
  opportunity: 'Oportunidad nueva validada',
  first_close: 'Primera carga cerrada de la competencia',
  extra_quote: 'Cotizacion nueva (cada una suma +1)',
  reactivated_or_referral: 'Cierre de cliente reactivado o referido',
  cold_call_quote: 'Cotizacion nueva por cold calling',
  cold_call_close: 'Venta cerrada por cold calling',
  big_fish: 'Big Fish (mayor broker fee del dia)',
  adjustment: 'Ajuste manual',
}

/** Etiqueta corta, para graficas y tablas angostas. */
export const KIND_SHORT_LABELS: Record<EntryKind, string> = {
  opportunity: 'Oportunidad',
  first_close: 'Primer cierre',
  extra_quote: 'Cotizacion nueva',
  reactivated_or_referral: 'Reactivado / referido',
  cold_call_quote: 'Cotizacion cold call',
  cold_call_close: 'Cierre cold call',
  big_fish: 'Big Fish',
  adjustment: 'Ajuste',
}

export const ENTRY_KINDS = Object.keys(POINTS_BY_KIND) as EntryKind[]

/** Los tipos que son "bono": todo lo que no es la oportunidad base ni un ajuste. */
const BONUS_KINDS: ReadonlySet<EntryKind> = new Set<EntryKind>([
  'first_close',
  'extra_quote',
  'reactivated_or_referral',
  'cold_call_quote',
  'cold_call_close',
  'big_fish',
])

export function isBonusKind(kind: EntryKind): boolean {
  return BONUS_KINDS.has(kind)
}

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export type Phase = 'before' | 'phase1' | 'phase2' | 'ended'

export function phaseForDate(date: string): Phase {
  if (date < PHASE1_START) return 'before'
  if (date <= PHASE1_END) return 'phase1'
  if (date <= PHASE2_END) return 'phase2'
  return 'ended'
}

export function currentPhase(date: string = today()): Phase {
  return phaseForDate(date)
}

/** El instante del corte que cierra la fase actual (3:00 PM de Guatemala). */
export function phaseDeadline(phase: Phase): Date {
  if (phase === 'before') return cutoffInstant(PHASE1_START)
  if (phase === 'phase1') return cutoffInstant(PHASE1_END)
  return cutoffInstant(PHASE2_END)
}

export const PHASE_LABELS: Record<Phase, string> = {
  before: 'Aun no inicia',
  phase1: 'Fase 1 - TOP HUNTER',
  phase2: 'Fase 2 - Tablero continuo',
  ended: 'Competencia finalizada',
}

/** En la Fase 1 el numero grande es el conteo de oportunidades; despues, los puntos. */
export function headlineMetric(phase: Phase): 'opportunities' | 'points' {
  return phase === 'phase1' || phase === 'before' ? 'opportunities' : 'points'
}

// ---------------------------------------------------------------------------
// Filtros base
// ---------------------------------------------------------------------------

/** Unico lugar donde se decide si una entrada puntea. */
export function scores(entry: Entry): boolean {
  return entry.status === 'approved' && isWithin(entry.date, COMPETITION_START, COMPETITION_END)
}

export function approvedEntries(entries: Entry[]): Entry[] {
  return entries.filter(scores)
}

/**
 * Puntos que aporta una entrada al tablero acumulado.
 *
 * Los bonos ganados durante la Fase 1 dependen de BONUS_POINTS_COUNT_IN_PHASE1
 * (ver src/config/competition.ts). El ranking de la Fase 1 nunca usa esta
 * funcion: ese se decide por conteo de oportunidades.
 */
export function pointsOf(entry: Entry): number {
  if (!scores(entry)) return 0
  if (!BONUS_POINTS_COUNT_IN_PHASE1 && isBonusKind(entry.kind) && entry.date <= PHASE1_END) return 0
  return entry.points
}

/** Un Big Fish valido: aprobado, dentro de la ventana y con fee sobre el minimo. */
export function isValidBigFish(entry: Entry): boolean {
  return (
    scores(entry) &&
    entry.kind === 'big_fish' &&
    isWithin(entry.date, BIG_FISH_START, BIG_FISH_END) &&
    entry.brokerFee > BIG_FISH_MIN_FEE
  )
}

// ---------------------------------------------------------------------------
// Calificacion para el premio final
// ---------------------------------------------------------------------------

export interface Qualification {
  qualified: boolean
  /** Fee cobrado acumulado (USD). */
  feeCollected: number
  feeRequired: number
  feeMet: boolean
  /** Oportunidades validadas acumuladas. */
  loads: number
  /** Cargas exigidas a la fecha: 1 por cada dia transcurrido de competencia. */
  loadsRequired: number
  loadsMet: boolean
}

/** Dias de competencia transcurridos hasta `asOf` (0 si aun no inicia). */
export function elapsedCompetitionDays(asOf: string = today()): number {
  if (asOf < COMPETITION_START) return 0
  const day = clampDate(asOf, COMPETITION_START, COMPETITION_END)
  return daysBetween(COMPETITION_START, day) + 1
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface BrokerStanding {
  broker: Broker
  rank: number
  /** Numero que decide la fase actual. */
  headline: number
  /** Oportunidades validadas en la ventana de la Fase 1 (16 - 23 sep). */
  phase1Opportunities: number
  /** Oportunidades validadas en toda la competencia. */
  opportunities: number
  /** Puntos acumulados (tablero continuo). */
  points: number
  /** Puntos ganados dentro de la ventana de la Fase 2. */
  phase2Points: number
  /** Oportunidades de la Fase 1 que llegaron a cotizacion enviada (desempate 1). */
  phase1QuotesSent: number
  /** Broker fee cobrado de las oportunidades de la Fase 1 (desempate 2). */
  phase1FeeConfirmed: number
  /** Broker fee cobrado, acumulado. */
  feeCollected: number
  /** Broker fee registrado pero aun no cobrado. */
  feePending: number
  feeTotal: number
  qualification: Qualification
  /** Puntos por tipo de entrada. */
  pointsByKind: Record<EntryKind, number>
  /** Conteo de entradas por tipo. */
  countByKind: Record<EntryKind, number>
  /** Entradas aprobadas del broker, mas recientes primero. */
  entries: Entry[]
  /** Entradas pendientes de validar (no puntean, se muestran como aviso). */
  pendingCount: number
  bigFishWins: number
}

function emptyKindRecord(): Record<EntryKind, number> {
  const out = {} as Record<EntryKind, number>
  for (const kind of ENTRY_KINDS) out[kind] = 0
  return out
}

/**
 * Calcula el tablero completo.
 *
 * @param brokers  los brokers que compiten
 * @param entries  todas las entradas (se filtran adentro; pasar el set completo)
 * @param asOf     fecha 'YYYY-MM-DD' de Guatemala contra la que se evalua
 */
export function computeStandings(
  brokers: Broker[],
  entries: Entry[],
  asOf: string = today(),
): BrokerStanding[] {
  const phase = phaseForDate(asOf)
  const metric = headlineMetric(phase)
  const loadsRequired = elapsedCompetitionDays(asOf) * QUALIFY_LOADS_PER_DAY

  const byBroker = new Map<string, Entry[]>()
  for (const entry of entries) {
    const list = byBroker.get(entry.brokerId)
    if (list) list.push(entry)
    else byBroker.set(entry.brokerId, [entry])
  }

  const standings: BrokerStanding[] = brokers.map((broker) => {
    const all = byBroker.get(broker.id) ?? []
    const approved = all.filter(scores)

    const pointsByKind = emptyKindRecord()
    const countByKind = emptyKindRecord()

    let phase1Opportunities = 0
    let opportunities = 0
    let points = 0
    let phase2Points = 0
    let phase1QuotesSent = 0
    let phase1FeeConfirmed = 0
    let feeCollected = 0
    let feePending = 0
    let bigFishWins = 0

    for (const entry of approved) {
      const entryPoints = pointsOf(entry)
      points += entryPoints
      pointsByKind[entry.kind] += entryPoints
      countByKind[entry.kind] += 1

      if (isWithin(entry.date, PHASE2_START, PHASE2_END)) phase2Points += entryPoints

      if (entry.kind === 'opportunity') {
        opportunities += 1
        if (isWithin(entry.date, PHASE1_START, PHASE1_END)) {
          phase1Opportunities += 1
          if (entry.quoteSent) phase1QuotesSent += 1
          if (entry.feeCollected) phase1FeeConfirmed += entry.brokerFee
        }
      }

      if (isValidBigFish(entry)) bigFishWins += 1

      if (entry.brokerFee > 0) {
        if (entry.feeCollected) feeCollected += entry.brokerFee
        else feePending += entry.brokerFee
      }
    }

    const feeMet = feeCollected >= QUALIFY_FEE_FLOOR
    const loadsMet = opportunities >= loadsRequired

    return {
      broker,
      rank: 0,
      headline: metric === 'opportunities' ? phase1Opportunities : points,
      phase1Opportunities,
      opportunities,
      points,
      phase2Points,
      phase1QuotesSent,
      phase1FeeConfirmed,
      feeCollected,
      feePending,
      feeTotal: feeCollected + feePending,
      qualification: {
        qualified: feeMet && loadsMet,
        feeCollected,
        feeRequired: QUALIFY_FEE_FLOOR,
        feeMet,
        loads: opportunities,
        loadsRequired,
        loadsMet,
      },
      pointsByKind,
      countByKind,
      entries: approved.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
      pendingCount: all.filter((e) => e.status === 'pending').length,
      bigFishWins,
    }
  })

  standings.sort(metric === 'opportunities' ? comparePhase1 : comparePhase2)
  standings.forEach((standing, index) => {
    standing.rank = index + 1
  })
  return standings
}

/**
 * Fase 1: mas oportunidades validadas.
 * Desempate 1: mas oportunidades que llegaron a cotizacion enviada.
 * Desempate 2: mayor broker fee confirmado de esas oportunidades.
 */
function comparePhase1(a: BrokerStanding, b: BrokerStanding): number {
  return (
    b.phase1Opportunities - a.phase1Opportunities ||
    b.phase1QuotesSent - a.phase1QuotesSent ||
    b.phase1FeeConfirmed - a.phase1FeeConfirmed ||
    a.broker.name.localeCompare(b.broker.name, 'es')
  )
}

/** Fase 2: mas puntos, luego mas oportunidades, luego mas fee cobrado. */
function comparePhase2(a: BrokerStanding, b: BrokerStanding): number {
  return (
    b.points - a.points ||
    b.opportunities - a.opportunities ||
    b.feeCollected - a.feeCollected ||
    a.broker.name.localeCompare(b.broker.name, 'es')
  )
}

// ---------------------------------------------------------------------------
// Series para graficas - todas salen de las mismas entradas aprobadas
// ---------------------------------------------------------------------------

export type ChartRow = Record<string, number | string>

/** Oportunidades validadas por dia y por broker. */
export function opportunitiesPerDay(
  entries: Entry[],
  days: string[],
  brokerIds: string[],
): ChartRow[] {
  const bucket = new Map<string, number>()
  for (const entry of approvedEntries(entries)) {
    if (entry.kind !== 'opportunity') continue
    const key = entry.date + '|' + entry.brokerId
    bucket.set(key, (bucket.get(key) ?? 0) + 1)
  }
  return days.map((date) => {
    const row: ChartRow = { date }
    for (const id of brokerIds) row[id] = bucket.get(date + '|' + id) ?? 0
    return row
  })
}

/** Puntos acumulados por broker a lo largo del tiempo. */
export function cumulativePoints(
  entries: Entry[],
  days: string[],
  brokerIds: string[],
): ChartRow[] {
  const bucket = new Map<string, number>()
  for (const entry of approvedEntries(entries)) {
    const key = entry.date + '|' + entry.brokerId
    bucket.set(key, (bucket.get(key) ?? 0) + pointsOf(entry))
  }
  const running = new Map<string, number>(brokerIds.map((id) => [id, 0]))
  return days.map((date) => {
    const row: ChartRow = { date }
    for (const id of brokerIds) {
      const next = (running.get(id) ?? 0) + (bucket.get(date + '|' + id) ?? 0)
      running.set(id, next)
      row[id] = next
    }
    return row
  })
}

/** Puntos por semana de competencia y por broker. */
export function pointsPerWeek(entries: Entry[], brokerIds: string[]): ChartRow[] {
  const bucket = new Map<number, Map<string, number>>()
  let maxWeek = 1
  for (const entry of approvedEntries(entries)) {
    const week = weekIndex(entry.date, COMPETITION_START)
    maxWeek = Math.max(maxWeek, week)
    let row = bucket.get(week)
    if (!row) {
      row = new Map()
      bucket.set(week, row)
    }
    row.set(entry.brokerId, (row.get(entry.brokerId) ?? 0) + pointsOf(entry))
  }
  const weeks: ChartRow[] = []
  for (let week = 1; week <= maxWeek; week++) {
    const row: ChartRow = { week: 'Semana ' + week }
    const values = bucket.get(week)
    for (const id of brokerIds) row[id] = values?.get(id) ?? 0
    weeks.push(row)
  }
  return weeks
}

/** Los ultimos `length` dias de un broker, para el sparkline de su fila. */
export function recentDaily(
  entries: Entry[],
  brokerId: string,
  endDate: string,
  length = 7,
): Array<{ date: string; value: number }> {
  const bucket = new Map<string, number>()
  for (const entry of approvedEntries(entries)) {
    if (entry.brokerId !== brokerId) continue
    bucket.set(entry.date, (bucket.get(entry.date) ?? 0) + pointsOf(entry))
  }
  const out: Array<{ date: string; value: number }> = []
  for (let i = length - 1; i >= 0; i--) {
    const date = addDays(endDate, -i)
    out.push({ date, value: bucket.get(date) ?? 0 })
  }
  return out
}

/** El Big Fish de un dia: la entrada valida con el mayor broker fee. */
export function bigFishOfDay(entries: Entry[], date: string): Entry | null {
  let best: Entry | null = null
  for (const entry of entries) {
    if (!isValidBigFish(entry) || entry.date !== date) continue
    if (!best || entry.brokerFee > best.brokerFee) best = entry
  }
  return best
}

/** Reparto de puntos por tipo, sumando a todos los brokers o a uno solo. */
export function pointsBreakdown(
  entries: Entry[],
  brokerId?: string,
): Array<{ kind: EntryKind; label: string; points: number; count: number }> {
  const points = emptyKindRecord()
  const counts = emptyKindRecord()
  for (const entry of approvedEntries(entries)) {
    if (brokerId && entry.brokerId !== brokerId) continue
    points[entry.kind] += pointsOf(entry)
    counts[entry.kind] += 1
  }
  return ENTRY_KINDS.map((kind) => ({
    kind,
    label: KIND_SHORT_LABELS[kind],
    points: points[kind],
    count: counts[kind],
  })).filter((row) => row.count > 0)
}

/** Fee cobrado y pendiente por broker, para la grafica de barras de dinero. */
export function feeByBroker(
  standings: BrokerStanding[],
): Array<{ id: string; name: string; cobrado: number; pendiente: number }> {
  return standings
    .map((s) => ({
      id: s.broker.id,
      name: s.broker.name,
      cobrado: s.feeCollected,
      pendiente: s.feePending,
    }))
    .sort((a, b) => b.cobrado + b.pendiente - (a.cobrado + a.pendiente))
}
