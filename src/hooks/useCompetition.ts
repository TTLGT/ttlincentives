import { useEffect, useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import {
  computeStandings,
  currentPhase,
  headlineMetric,
  phaseDeadline,
  type BrokerStanding,
  type Phase,
} from '../lib/scoring'
import { clampDate, dateRange, today } from '../lib/dates'
import { COMPETITION_END, COMPETITION_START } from '../config/competition'

export interface CompetitionView {
  standings: BrokerStanding[]
  phase: Phase
  metric: 'opportunities' | 'points'
  deadline: Date
  /** Hoy en hora de Guatemala. */
  todayGt: string
  /** Dias de la competencia hasta hoy (o el rango completo si ya termino). */
  days: string[]
  loading: boolean
}

/**
 * Los numeros de todo el sitio, en un solo lugar.
 *
 * Cada pantalla llama a este hook y este llama a computeStandings, que es la
 * unica funcion que decide puntaje. Asi el tablero, las graficas y la pagina
 * de cada broker no pueden desfasarse entre si.
 */
export function useCompetition(): CompetitionView {
  const { brokers, entries, loading } = useData()

  // La fecha se recalcula sola: si la TV queda encendida toda la noche, a la
  // medianoche de Guatemala el tablero pasa al dia siguiente sin recargar.
  const [todayGt, setTodayGt] = useState(today)
  useEffect(() => {
    const id = setInterval(() => setTodayGt(today()), 60_000)
    return () => clearInterval(id)
  }, [])

  return useMemo(() => {
    const phase = currentPhase(todayGt)
    const lastDay = clampDate(todayGt, COMPETITION_START, COMPETITION_END)
    return {
      standings: computeStandings(brokers, entries, todayGt),
      phase,
      metric: headlineMetric(phase),
      deadline: phaseDeadline(phase),
      todayGt,
      days: dateRange(COMPETITION_START, lastDay),
      loading,
    }
  }, [brokers, entries, todayGt, loading])
}
