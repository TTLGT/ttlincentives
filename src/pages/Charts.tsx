import { useMemo, useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { OpportunitiesChart } from '../components/charts/OpportunitiesChart'
import { CumulativeChart } from '../components/charts/CumulativeChart'
import { WeeklyChart } from '../components/charts/WeeklyChart'
import { FeeChart } from '../components/charts/FeeChart'
import { BreakdownChart } from '../components/charts/BreakdownChart'
import { SourceChart } from '../components/charts/SourceChart'
import { useCompetition } from '../hooks/useCompetition'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { MAX_COLORED_SERIES } from '../lib/palette'
import { money } from '../lib/format'

export function Charts() {
  const { standings, days, loading } = useCompetition()
  const { entries } = useData()
  const { dark } = useTheme()
  const [selected, setSelected] = useState('all')

  // Los brokers en orden de tablero: define cuales llevan color propio.
  const brokers = useMemo(() => standings.map((s) => s.broker), [standings])

  // Alto proporcional al numero de brokers para las barras horizontales.
  const rowChartHeight = Math.max(320, brokers.length * 26 + 90)

  if (loading && brokers.length === 0) {
    return <p className="card p-8 text-center text-navy-600 dark:text-navy-300">Cargando graficas...</p>
  }

  if (brokers.length === 0) {
    return (
      <p className="card p-8 text-center text-navy-600 dark:text-navy-300">
        No hay brokers cargados todavia.
      </p>
    )
  }

  const totalFee = standings.reduce((sum, s) => sum + s.feeCollected, 0)
  const totalPoints = standings.reduce((sum, s) => sum + s.points, 0)
  const totalOpportunities = standings.reduce((sum, s) => sum + s.opportunities, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 sm:text-3xl dark:text-white">Graficas</h1>
          <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
            Todo lo que se ve aqui sale de las entradas validadas. Las pendientes no suman.
          </p>
        </div>
        <dl className="flex flex-wrap gap-6">
          <Stat label="Oportunidades" value={String(totalOpportunities)} />
          <Stat label="Puntos" value={String(totalPoints)} />
          <Stat label="Fee cobrado" value={money(totalFee)} />
        </dl>
      </header>

      <ChartCard
        title="Oportunidades validadas por dia"
        subtitle="Cuantas oportunidades nuevas entraron cada dia de la competencia."
        height={380}
        controls={
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-navy-700 dark:text-navy-200">Broker</span>
            <select
              className="field w-auto"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="all">Todos (apilado)</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </select>
          </label>
        }
        footnote={
          selected === 'all'
            ? `Los primeros ${MAX_COLORED_SERIES} del tablero llevan color propio; el resto se suma en "Otros". Para ver a alguien en particular, usa el filtro.`
            : undefined
        }
      >
        <OpportunitiesChart
          entries={entries}
          days={days}
          brokers={brokers}
          selected={selected}
          dark={dark}
        />
      </ChartCard>

      <ChartCard
        title="Puntos acumulados por broker"
        subtitle="Una linea por broker. Hace clic en un nombre de la leyenda para aislarlo."
        height={460}
      >
        <CumulativeChart entries={entries} days={days} brokers={brokers} dark={dark} />
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Puntos por semana"
          subtitle="Cuanto aporto cada semana de competencia."
          height={rowChartHeight}
        >
          <WeeklyChart entries={entries} brokers={brokers} dark={dark} />
        </ChartCard>

        <ChartCard
          title="Broker fee por broker"
          subtitle="Cobrado y pendiente de cobro. Visible para todos los que tienen acceso."
          height={rowChartHeight}
          footnote={`La linea punteada marca el piso de ${money(2000)} de fee cobrado que hay que alcanzar para calificar al premio final.`}
        >
          <FeeChart standings={standings} dark={dark} />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="De donde salen los puntos"
          subtitle="Reparto por tipo de entrada, sumando a todos los brokers."
          height={360}
        >
          <BreakdownChart entries={entries} dark={dark} />
        </ChartCard>

        <ChartCard
          title="De donde vienen las oportunidades"
          subtitle="La fuente que el broker marco en el formulario."
          height={360}
        >
          <SourceChart entries={entries} dark={dark} />
        </ChartCard>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-navy-500 uppercase dark:text-navy-400">
        {label}
      </dt>
      <dd className="tnum text-2xl font-bold text-navy-950 dark:text-white">{value}</dd>
    </div>
  )
}
