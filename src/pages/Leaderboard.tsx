import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Fish, Trophy } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Countdown } from '../components/Countdown'
import { QualificationBadge } from '../components/QualificationBadge'
import { Sparkline } from '../components/Sparkline'
import { useCompetition } from '../hooks/useCompetition'
import { useData } from '../context/DataContext'
import { bigFishOfDay, PHASE_LABELS, recentDaily, type BrokerStanding } from '../lib/scoring'
import { longLabel } from '../lib/dates'
import { money } from '../lib/format'
import {
  PHASE1_TITLE,
  PHASE2_TITLE,
  PRIZE_PHASE1,
  PRIZE_PHASE2,
  COMPETITION_NAME,
} from '../config/competition'

export function Leaderboard() {
  const { standings, phase, metric, deadline, todayGt, loading } = useCompetition()
  const { entries } = useData()

  const sparklines = useMemo(() => {
    const map = new Map<string, Array<{ date: string; value: number }>>()
    let max = 1
    for (const standing of standings) {
      const series = recentDaily(entries, standing.broker.id, todayGt, 7)
      map.set(standing.broker.id, series)
      for (const point of series) max = Math.max(max, point.value)
    }
    return { map, max }
  }, [standings, entries, todayGt])

  const bigFish = useMemo(() => bigFishOfDay(entries, todayGt), [entries, todayGt])
  const bigFishBroker = standings.find((s) => s.broker.id === bigFish?.brokerId)

  const podium = standings.slice(0, 3)
  const rest = standings.slice(3)

  return (
    <div className="space-y-6">
      <PhaseHeader phase={phase} deadline={deadline} todayGt={todayGt} />

      {loading && standings.length === 0 && (
        <p className="card p-8 text-center text-navy-600 dark:text-navy-300">Cargando tablero...</p>
      )}

      {!loading && standings.length === 0 && (
        <div className="card p-8 text-center">
          <p className="font-semibold text-navy-900 dark:text-white">Todavia no hay brokers cargados.</p>
          <p className="mt-2 text-sm text-navy-600 dark:text-navy-300">
            Corre <code className="rounded bg-navy-100 px-1.5 py-0.5 dark:bg-navy-800">node scripts/seed-members.js</code>{' '}
            para sembrar el roster.
          </p>
        </div>
      )}

      {phase === 'phase2' && <BigFishCard entry={bigFish} standing={bigFishBroker} />}

      {podium.length > 0 && <Podium standings={podium} metric={metric} />}

      {standings.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-navy-200 px-4 py-3 sm:px-6 dark:border-navy-800">
            <h2 className="text-lg font-bold text-navy-950 dark:text-white">Tabla completa</h2>
            <p className="text-xs text-navy-500 dark:text-navy-400">
              {standings.length} brokers - actualizado en vivo
            </p>
          </div>
          <ul className="divide-y divide-navy-100 dark:divide-navy-800">
            {rest.length > 0 || podium.length > 0
              ? standings.map((standing) => (
                  <li key={standing.broker.id}>
                    <Row
                      standing={standing}
                      metric={metric}
                      spark={sparklines.map.get(standing.broker.id) ?? []}
                      sparkMax={sparklines.max}
                    />
                  </li>
                ))
              : null}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function PhaseHeader({
  phase,
  deadline,
  todayGt,
}: {
  phase: ReturnType<typeof useCompetition>['phase']
  deadline: Date
  todayGt: string
}) {
  const subtitle =
    phase === 'phase1'
      ? `Gana quien acumule mas oportunidades nuevas validadas. Premio ${PHASE1_TITLE} ${PRIZE_PHASE1}.`
      : phase === 'phase2'
        ? `Tablero continuo por puntos. Premio ${PHASE2_TITLE} ${PRIZE_PHASE2}.`
        : phase === 'before'
          ? 'La competencia arranca el 16 de septiembre.'
          : 'La competencia termino. El tablero queda como quedo al cierre.'

  const countdownLabel =
    phase === 'phase1' ? 'Cierra la Fase 1' : phase === 'before' ? 'Arranca en' : 'Cierre final'

  return (
    <section className="rounded-xl bg-navy-900 px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-navy-700 px-3 py-1 text-xs font-bold tracking-wide text-navy-100 uppercase">
            {PHASE_LABELS[phase]}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {COMPETITION_NAME}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-navy-200 sm:text-base">{subtitle}</p>
          <p className="mt-1 text-xs text-navy-300">Hoy: {longLabel(todayGt)} (hora de Guatemala)</p>
        </div>
        <div className="shrink-0">
          <Countdown target={deadline} label={countdownLabel} />
          <p className="mt-1 text-center text-xs text-navy-300 sm:text-right">Corte 3:00 PM</p>
        </div>
      </div>
    </section>
  )
}

function Podium({ standings, metric }: { standings: BrokerStanding[]; metric: 'opportunities' | 'points' }) {
  // Orden visual del podio: 2 - 1 - 3 en pantallas anchas.
  const order = [standings[1], standings[0], standings[2]].filter(Boolean)
  const medal = ['bg-navy-400', 'bg-gold-500', 'bg-amber-700']

  return (
    <section aria-label="Podio">
      <div className="grid gap-4 sm:grid-cols-3">
        {order.map((standing) => {
          const isFirst = standing.rank === 1
          return (
            <Link
              key={standing.broker.id}
              to={`/broker/${standing.broker.id}`}
              className={`card flex flex-col items-center p-5 text-center transition-transform hover:-translate-y-0.5 ${
                isFirst ? 'sm:order-2 sm:scale-105 ring-2 ring-gold-500' : standing.rank === 2 ? 'sm:order-1' : 'sm:order-3'
              }`}
            >
              <div className="relative">
                <Avatar broker={standing.broker} size={isFirst ? 'hero' : 'xl'} ring />
                <span
                  className={`absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${medal[standing.rank - 1]}`}
                >
                  {standing.rank}
                </span>
              </div>
              <p className="mt-3 text-base font-bold text-navy-950 sm:text-lg dark:text-white">
                {standing.broker.name}
              </p>
              <p className="tnum mt-1 text-4xl font-bold text-navy-800 sm:text-5xl dark:text-white">
                {metric === 'opportunities' ? standing.phase1Opportunities : standing.points}
              </p>
              <p className="text-xs font-semibold tracking-wide text-navy-500 uppercase dark:text-navy-300">
                {metric === 'opportunities' ? 'oportunidades' : 'puntos'}
              </p>
              <p className="tnum mt-2 text-sm text-navy-600 dark:text-navy-300">
                {metric === 'opportunities'
                  ? `${standing.points} pts`
                  : `${standing.opportunities} oportunidades`}
              </p>
              <p className="tnum mt-1 text-sm font-semibold text-navy-900 dark:text-navy-100">
                {money(standing.feeCollected)} cobrado
              </p>
              <div className="mt-3">
                <QualificationBadge q={standing.qualification} compact />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function Row({
  standing,
  metric,
  spark,
  sparkMax,
}: {
  standing: BrokerStanding
  metric: 'opportunities' | 'points'
  spark: Array<{ date: string; value: number }>
  sparkMax: number
}) {
  const headline = metric === 'opportunities' ? standing.phase1Opportunities : standing.points
  const secondary = metric === 'opportunities' ? standing.points : standing.opportunities
  const secondaryLabel = metric === 'opportunities' ? 'pts' : 'oport.'

  return (
    <Link
      to={`/broker/${standing.broker.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-navy-50 sm:px-6 dark:hover:bg-navy-800/60"
    >
      <span className="tnum w-8 shrink-0 text-center text-xl font-bold text-navy-400 sm:text-2xl dark:text-navy-400">
        {standing.rank}
      </span>

      <Avatar broker={standing.broker} size="md" />

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-base font-bold text-navy-950 sm:text-lg dark:text-white">
          {standing.broker.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <QualificationBadge q={standing.qualification} compact />
          {standing.bigFishWins > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 dark:text-navy-300">
              <Fish className="h-3.5 w-3.5" aria-hidden="true" />
              {standing.bigFishWins} Big Fish
            </span>
          )}
          {standing.pendingCount > 0 && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {standing.pendingCount} pendiente{standing.pendingCount === 1 ? '' : 's'} de validar
            </span>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 sm:block" aria-hidden="false">
        <Sparkline data={spark} max={sparkMax} />
        <p className="mt-0.5 text-[10px] tracking-wide text-navy-400 uppercase">ultimos 7 dias</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum text-sm font-semibold text-navy-900 dark:text-navy-100">
          {money(standing.feeCollected)}
        </p>
        <p className="text-[11px] text-navy-500 dark:text-navy-400">cobrado</p>
        <p className="tnum text-sm text-navy-600 dark:text-navy-300">
          {money(standing.feePending)}
        </p>
        <p className="text-[11px] text-navy-500 dark:text-navy-400">pendiente</p>
      </div>

      <div className="w-20 shrink-0 text-right">
        <p className="tnum text-3xl leading-none font-bold text-navy-900 sm:text-4xl dark:text-white">
          {headline}
        </p>
        <p className="text-[11px] font-semibold tracking-wide text-navy-500 uppercase dark:text-navy-400">
          {metric === 'opportunities' ? 'oportunidades' : 'puntos'}
        </p>
        <p className="tnum mt-1 text-sm text-navy-500 dark:text-navy-300">
          {secondary} {secondaryLabel}
        </p>
      </div>
    </Link>
  )
}

function BigFishCard({
  entry,
  standing,
}: {
  entry: ReturnType<typeof bigFishOfDay>
  standing?: BrokerStanding
}) {
  return (
    <section className="card flex flex-wrap items-center gap-4 border-gold-500 p-4 sm:p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-500/15">
        <Fish className="h-6 w-6 text-gold-600 dark:text-gold-400" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide text-navy-500 uppercase dark:text-navy-300">
          Big Fish de hoy
        </p>
        {entry && standing ? (
          <p className="mt-0.5 text-lg font-bold text-navy-950 dark:text-white">
            {standing.broker.name} -{' '}
            <span className="tnum text-gold-600 dark:text-gold-400">{money(entry.brokerFee)}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-base text-navy-600 dark:text-navy-300">
            Sin Big Fish todavia. Se marca en el corte de las 3:00 PM.
          </p>
        )}
      </div>
      {entry && standing && (
        <Link to={`/broker/${standing.broker.id}`} className="btn-ghost">
          <Trophy className="h-4 w-4" aria-hidden="true" />
          Ver broker
        </Link>
      )}
    </section>
  )
}
