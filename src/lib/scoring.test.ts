/**
 * Pruebas del motor de puntaje.
 *
 * Esto es lo que decide quien gana Q500, asi que las reglas que mas duelen si
 * se rompen estan cubiertas aqui: que las pendientes no sumen, los desempates
 * de la Fase 1, el piso de fee y el minimo de cargas.
 */

import { describe, expect, it } from 'vitest'
import {
  bigFishOfDay,
  computeStandings,
  cumulativePoints,
  elapsedCompetitionDays,
  isValidBigFish,
  opportunitiesPerDay,
  phaseForDate,
  pointsOf,
} from './scoring'
import { addDays, dateRange, daysBetween, toGuatemalaDate, weekIndex } from './dates'
import type { Broker, Entry, EntryKind } from '../types'

const broker = (id: string, name: string): Broker => ({
  id,
  name,
  email: `${id}@totaltransportlogistics.us`,
  photoData: null,
  active: true,
  joinedAt: '2026-09-16',
})

let seq = 0
function entry(partial: Partial<Entry> & { brokerId: string; date: string }): Entry {
  const kind: EntryKind = partial.kind ?? 'opportunity'
  return {
    id: `e${seq++}`,
    kind,
    points: partial.points ?? 1,
    quoteSent: partial.quoteSent ?? false,
    brokerFee: partial.brokerFee ?? 0,
    feeCollected: partial.feeCollected ?? false,
    status: partial.status ?? 'approved',
    note: '',
    createdBy: 'erwin@totaltransportlogistics.us',
    createdAt: '2026-09-16T12:00:00.000Z',
    updatedBy: 'erwin@totaltransportlogistics.us',
    updatedAt: '2026-09-16T12:00:00.000Z',
    ...partial,
  }
}

const A = broker('alexis-garcia', 'ALEXIS GARCIA')
const B = broker('alex-flores', 'ALEX FLORES')

describe('fechas en hora de Guatemala', () => {
  it('resta seis horas al instante UTC', () => {
    // 17 sep 03:00 UTC son todavia las 21:00 del 16 en Guatemala.
    expect(toGuatemalaDate(new Date('2026-09-17T03:00:00Z'))).toBe('2026-09-16')
    expect(toGuatemalaDate(new Date('2026-09-17T06:00:00Z'))).toBe('2026-09-17')
  })

  it('suma dias y cuenta diferencias sin desfases', () => {
    expect(addDays('2026-09-16', 7)).toBe('2026-09-23')
    expect(addDays('2026-09-30', -1)).toBe('2026-09-29')
    expect(daysBetween('2026-09-16', '2026-09-23')).toBe(7)
    expect(dateRange('2026-09-16', '2026-09-18')).toEqual([
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ])
  })

  it('agrupa por semana de competencia', () => {
    expect(weekIndex('2026-09-16', '2026-09-16')).toBe(1)
    expect(weekIndex('2026-09-22', '2026-09-16')).toBe(1)
    expect(weekIndex('2026-09-23', '2026-09-16')).toBe(2)
  })
})

describe('fases', () => {
  it('ubica cada fecha en su fase', () => {
    expect(phaseForDate('2026-09-15')).toBe('before')
    expect(phaseForDate('2026-09-16')).toBe('phase1')
    expect(phaseForDate('2026-09-23')).toBe('phase1')
    expect(phaseForDate('2026-09-24')).toBe('phase2')
    expect(phaseForDate('2026-09-30')).toBe('phase2')
    expect(phaseForDate('2026-10-01')).toBe('ended')
  })

  it('cuenta los dias transcurridos', () => {
    expect(elapsedCompetitionDays('2026-09-15')).toBe(0)
    expect(elapsedCompetitionDays('2026-09-16')).toBe(1)
    expect(elapsedCompetitionDays('2026-09-20')).toBe(5)
    // Despues del cierre no sigue creciendo.
    expect(elapsedCompetitionDays('2026-10-15')).toBe(15)
  })
})

describe('solo las entradas validadas puntean', () => {
  it('ignora pendientes y rechazadas', () => {
    expect(pointsOf(entry({ brokerId: A.id, date: '2026-09-16', status: 'pending' }))).toBe(0)
    expect(pointsOf(entry({ brokerId: A.id, date: '2026-09-16', status: 'rejected' }))).toBe(0)
    expect(pointsOf(entry({ brokerId: A.id, date: '2026-09-16', status: 'approved' }))).toBe(1)
  })

  it('ignora lo que cae fuera de la competencia', () => {
    expect(pointsOf(entry({ brokerId: A.id, date: '2026-09-15' }))).toBe(0)
    expect(pointsOf(entry({ brokerId: A.id, date: '2026-10-01' }))).toBe(0)
  })

  it('no suma una pendiente al tablero', () => {
    const [top] = computeStandings(
      [A],
      [
        entry({ brokerId: A.id, date: '2026-09-16' }),
        entry({ brokerId: A.id, date: '2026-09-17', status: 'pending' }),
      ],
      '2026-09-17',
    )
    expect(top.phase1Opportunities).toBe(1)
    expect(top.points).toBe(1)
    expect(top.pendingCount).toBe(1)
  })
})

describe('Fase 1: se decide por cantidad de oportunidades', () => {
  it('ordena por conteo, no por puntos', () => {
    const entries = [
      // A: 2 oportunidades y nada mas.
      entry({ brokerId: A.id, date: '2026-09-16' }),
      entry({ brokerId: A.id, date: '2026-09-17' }),
      // B: 1 oportunidad pero un cierre de 5 puntos.
      entry({ brokerId: B.id, date: '2026-09-16' }),
      entry({ brokerId: B.id, date: '2026-09-17', kind: 'cold_call_close', points: 5 }),
    ]
    const standings = computeStandings([A, B], entries, '2026-09-18')

    // A gana la Fase 1 aunque B tenga mas puntos.
    expect(standings[0].broker.id).toBe(A.id)
    expect(standings[0].headline).toBe(2)
    expect(standings[1].broker.id).toBe(B.id)
    expect(standings[1].points).toBeGreaterThan(standings[0].points)
  })

  it('desempata primero por cotizaciones enviadas', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', quoteSent: false }),
      entry({ brokerId: B.id, date: '2026-09-16', quoteSent: true }),
    ]
    const standings = computeStandings([A, B], entries, '2026-09-17')
    expect(standings[0].broker.id).toBe(B.id)
    expect(standings[0].phase1QuotesSent).toBe(1)
  })

  it('si sigue empatado, desempata por fee confirmado', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', quoteSent: true, brokerFee: 300, feeCollected: true }),
      entry({ brokerId: B.id, date: '2026-09-16', quoteSent: true, brokerFee: 900, feeCollected: true }),
    ]
    const standings = computeStandings([A, B], entries, '2026-09-17')
    expect(standings[0].broker.id).toBe(B.id)
    expect(standings[0].phase1FeeConfirmed).toBe(900)
  })

  it('el fee no cobrado no cuenta como confirmado', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', quoteSent: true, brokerFee: 900, feeCollected: false }),
    ]
    const [top] = computeStandings([A], entries, '2026-09-17')
    expect(top.phase1FeeConfirmed).toBe(0)
    expect(top.feePending).toBe(900)
    expect(top.feeCollected).toBe(0)
  })
})

describe('cotizaciones nuevas', () => {
  it('cada cotizacion suma +1, sin umbral diario', () => {
    // Confirmado por Erwin: la primera cotizacion del dia vale igual que la
    // cuarta. No hay minimo que superar antes de empezar a puntear.
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-25', kind: 'extra_quote', points: 1 }),
      entry({ brokerId: A.id, date: '2026-09-25', kind: 'extra_quote', points: 1 }),
      entry({ brokerId: A.id, date: '2026-09-25', kind: 'extra_quote', points: 1 }),
    ]
    const [top] = computeStandings([A], entries, '2026-09-25')
    expect(top.countByKind.extra_quote).toBe(3)
    expect(top.pointsByKind.extra_quote).toBe(3)
    expect(top.points).toBe(3)
  })
})

describe('Fase 2: se decide por puntos', () => {
  it('ordena por puntos acumulados', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-25' }),
      entry({ brokerId: A.id, date: '2026-09-26' }),
      entry({ brokerId: B.id, date: '2026-09-25', kind: 'reactivated_or_referral', points: 5 }),
    ]
    const standings = computeStandings([A, B], entries, '2026-09-27')
    expect(standings[0].broker.id).toBe(B.id)
    expect(standings[0].headline).toBe(5)
    expect(standings[1].headline).toBe(2)
  })
})

describe('calificacion al premio final', () => {
  it('exige los $2,000 cobrados y una carga por dia', () => {
    // Al 18 de septiembre van 3 dias, asi que hacen falta 3 cargas.
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', brokerFee: 2500, feeCollected: true }),
      entry({ brokerId: A.id, date: '2026-09-17' }),
      entry({ brokerId: A.id, date: '2026-09-18' }),
    ]
    const [top] = computeStandings([A], entries, '2026-09-18')
    expect(top.qualification.loadsRequired).toBe(3)
    expect(top.qualification.loads).toBe(3)
    expect(top.qualification.feeMet).toBe(true)
    expect(top.qualification.qualified).toBe(true)
  })

  it('no califica si le falta fee cobrado', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', brokerFee: 1900, feeCollected: true }),
    ]
    const [top] = computeStandings([A], entries, '2026-09-16')
    expect(top.qualification.feeMet).toBe(false)
    expect(top.qualification.qualified).toBe(false)
  })

  it('no califica si le faltan cargas', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-16', brokerFee: 5000, feeCollected: true }),
    ]
    // Al 20 de septiembre van 5 dias y solo tiene 1 carga.
    const [top] = computeStandings([A], entries, '2026-09-20')
    expect(top.qualification.loadsRequired).toBe(5)
    expect(top.qualification.loadsMet).toBe(false)
    expect(top.qualification.qualified).toBe(false)
  })
})

describe('Big Fish', () => {
  it('exige fee mayor a $500 y estar dentro de la ventana', () => {
    const inWindow = entry({
      brokerId: A.id,
      date: '2026-09-25',
      kind: 'big_fish',
      points: 2,
      brokerFee: 800,
    })
    expect(isValidBigFish(inWindow)).toBe(true)

    // Antes del 24 no corre.
    expect(isValidBigFish({ ...inWindow, date: '2026-09-20' })).toBe(false)
    // $500 exactos no pasan: la regla dice "mayor a $500".
    expect(isValidBigFish({ ...inWindow, brokerFee: 500 })).toBe(false)
    // Pendiente no cuenta.
    expect(isValidBigFish({ ...inWindow, status: 'pending' })).toBe(false)
  })

  it('elige el fee mas alto del dia', () => {
    const entries = [
      entry({ brokerId: A.id, date: '2026-09-25', kind: 'big_fish', points: 2, brokerFee: 700 }),
      entry({ brokerId: B.id, date: '2026-09-25', kind: 'big_fish', points: 2, brokerFee: 1200 }),
    ]
    expect(bigFishOfDay(entries, '2026-09-25')?.brokerId).toBe(B.id)
    expect(bigFishOfDay(entries, '2026-09-26')).toBeNull()
  })
})

describe('series de las graficas', () => {
  const days = dateRange('2026-09-16', '2026-09-18')
  const entries = [
    entry({ brokerId: A.id, date: '2026-09-16' }),
    entry({ brokerId: A.id, date: '2026-09-16' }),
    entry({ brokerId: A.id, date: '2026-09-18', kind: 'first_close', points: 3 }),
    entry({ brokerId: B.id, date: '2026-09-17', status: 'pending' }),
  ]

  it('cuenta oportunidades por dia y deja fuera lo no validado', () => {
    const rows = opportunitiesPerDay(entries, days, [A.id, B.id])
    expect(rows[0]).toMatchObject({ date: '2026-09-16', [A.id]: 2, [B.id]: 0 })
    expect(rows[1]).toMatchObject({ date: '2026-09-17', [A.id]: 0, [B.id]: 0 })
    // El cierre del dia 18 no es oportunidad, no se cuenta aqui.
    expect(rows[2][A.id]).toBe(0)
  })

  it('acumula puntos sin retroceder', () => {
    const rows = cumulativePoints(entries, days, [A.id, B.id])
    expect(rows.map((r) => r[A.id])).toEqual([2, 2, 5])
    expect(rows.map((r) => r[B.id])).toEqual([0, 0, 0])
  })
})
