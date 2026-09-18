import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Fish, MessageSquare } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { ChartCard } from '../components/ChartCard'
import { BrokerDailyChart } from '../components/charts/BrokerDailyChart'
import { BreakdownChart } from '../components/charts/BreakdownChart'
import { SourceChart } from '../components/charts/SourceChart'
import { QualificationBadge } from '../components/QualificationBadge'
import { StatusPill } from '../components/StatusPill'
import { useCompetition } from '../hooks/useCompetition'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { KIND_SHORT_LABELS, pointsOf } from '../lib/scoring'
import { longLabel, shortLabel } from '../lib/dates'
import { money, moneyExact, signedPoints } from '../lib/format'

export function BrokerPage() {
  const { id = '' } = useParams()
  const { standings, days, metric, loading } = useCompetition()
  const { entries, comments } = useData()
  const { dark } = useTheme()

  const standing = standings.find((s) => s.broker.id === id)

  if (loading && !standing) {
    return <p className="card p-8 text-center text-navy-600 dark:text-navy-300">Cargando...</p>
  }

  if (!standing) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-navy-900 dark:text-white">No se encontro ese broker.</p>
        <Link to="/" className="btn-primary mt-4">
          Volver al tablero
        </Link>
      </div>
    )
  }

  const { broker, qualification } = standing
  const brokerComments = comments.filter((c) => c.brokerId === broker.id)
  // Historial completo, incluidas las pendientes y rechazadas: se muestran,
  // marcadas, aunque no sumen.
  const history = entries
    .filter((e) => e.brokerId === broker.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-navy-600 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver al tablero
      </Link>

      <header className="card flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:p-6">
        <Avatar broker={broker} size="hero" ring />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-500 dark:text-navy-300">
            Puesto #{standing.rank} de {standings.length}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-navy-950 sm:text-4xl dark:text-white">
            {broker.name}
          </h1>
          {standing.bigFishWins > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-sm font-semibold text-gold-600 dark:text-gold-400">
              <Fish className="h-4 w-4" aria-hidden="true" />
              {standing.bigFishWins} Big Fish
            </p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Oportunidades Fase 1"
              value={String(standing.phase1Opportunities)}
              big={metric === 'opportunities'}
            />
            <Stat label="Puntos totales" value={String(standing.points)} big={metric === 'points'} />
            <Stat label="Fee cobrado" value={money(standing.feeCollected)} />
            <Stat label="Fee pendiente" value={money(standing.feePending)} />
          </dl>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <SmallStat label="Oportunidades totales" value={String(standing.opportunities)} />
            <SmallStat label="Cotizaciones enviadas (F1)" value={String(standing.phase1QuotesSent)} />
            <SmallStat label="Puntos Fase 2" value={String(standing.phase2Points)} />
            <SmallStat label="Fee total registrado" value={money(standing.feeTotal)} />
          </dl>
        </div>

        <div className="w-full shrink-0 border-t border-navy-200 pt-5 sm:w-64 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 dark:border-navy-800">
          <QualificationBadge q={qualification} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Dia a dia" subtitle="Oportunidades validadas y puntos por dia." height={330}>
          <BrokerDailyChart entries={entries} brokerId={broker.id} days={days} dark={dark} />
        </ChartCard>

        <ChartCard title="De donde salen sus puntos" subtitle="Reparto por tipo de entrada." height={330}>
          <BreakdownChart entries={entries} brokerId={broker.id} dark={dark} />
        </ChartCard>

        <ChartCard
          title="De donde vienen sus oportunidades"
          subtitle="La fuente que marco en el formulario."
          height={330}
        >
          <SourceChart entries={entries} brokerId={broker.id} dark={dark} />
        </ChartCard>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-navy-200 px-4 py-3 sm:px-6 dark:border-navy-800">
          <h2 className="text-lg font-bold text-navy-950 dark:text-white">Historial de entradas</h2>
          <p className="mt-0.5 text-xs text-navy-500 dark:text-navy-400">
            Solo las entradas validadas suman. Este historial no contiene informacion de clientes.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="px-6 py-8 text-center text-navy-600 dark:text-navy-300">
            Todavia no hay entradas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-navy-50 text-xs tracking-wide text-navy-600 uppercase dark:bg-navy-950/60 dark:text-navy-300">
                <tr>
                  <th scope="col" className="px-4 py-2.5 sm:px-6">Fecha</th>
                  <th scope="col" className="px-4 py-2.5">Tipo</th>
                  <th scope="col" className="px-4 py-2.5">Fuente</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Puntos</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Broker fee</th>
                  <th scope="col" className="px-4 py-2.5">Estado</th>
                  <th scope="col" className="px-4 py-2.5 sm:px-6">Nota del admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
                {history.map((entry) => (
                  <tr key={entry.id} className={entry.status === 'approved' ? '' : 'opacity-70'}>
                    <td className="tnum px-4 py-2.5 whitespace-nowrap sm:px-6" title={longLabel(entry.date)}>
                      {shortLabel(entry.date)}
                    </td>
                    <td className="px-4 py-2.5 text-navy-800 dark:text-navy-100">
                      {KIND_SHORT_LABELS[entry.kind]}
                    </td>
                    <td className="px-4 py-2.5 text-navy-600 dark:text-navy-300">
                      {entry.source || <span className="text-navy-400">-</span>}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-navy-950 dark:text-white">
                      {entry.status === 'approved' ? signedPoints(pointsOf(entry)) : '-'}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right">
                      {entry.brokerFee > 0 ? (
                        <>
                          <span className="font-semibold text-navy-950 dark:text-white">
                            {moneyExact(entry.brokerFee)}
                          </span>
                          <span className="block text-xs text-navy-500 dark:text-navy-400">
                            {entry.feeCollected ? 'cobrado' : 'pendiente'}
                          </span>
                        </>
                      ) : (
                        <span className="text-navy-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={entry.status} />
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-navy-600 sm:px-6 dark:text-navy-300">
                      {entry.note || <span className="text-navy-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-navy-950 dark:text-white">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
          Comentarios del admin
        </h2>
        {brokerComments.length === 0 ? (
          <p className="mt-3 text-sm text-navy-600 dark:text-navy-300">Todavia no hay comentarios.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {brokerComments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-navy-200 bg-navy-50 p-3 dark:border-navy-800 dark:bg-navy-950/50"
              >
                <p className="text-navy-900 dark:text-navy-50">{comment.text}</p>
                <p className="mt-1.5 text-xs text-navy-500 dark:text-navy-400">
                  {comment.authorName} - {comment.createdAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-navy-500 uppercase dark:text-navy-400">
        {label}
      </dt>
      <dd
        className={`tnum font-bold text-navy-950 dark:text-white ${big ? 'text-4xl' : 'text-2xl'}`}
      >
        {value}
      </dd>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-navy-500 dark:text-navy-400">{label}</dt>
      <dd className="tnum font-semibold text-navy-900 dark:text-navy-100">{value}</dd>
    </div>
  )
}
