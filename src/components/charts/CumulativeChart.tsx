import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Broker, Entry } from '../../types'
import { cumulativePoints } from '../../lib/scoring'
import { buildColorMap, chartTheme, MAX_COLORED_SERIES } from '../../lib/palette'
import { longLabel, shortLabel } from '../../lib/dates'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  days: string[]
  /** En orden de tablero: los ocho primeros llevan color propio. */
  brokers: Broker[]
  dark: boolean
}

/**
 * Puntos acumulados por broker en el tiempo, una linea por broker.
 *
 * La leyenda es la lista completa de brokers: al hacer clic se aisla ese broker
 * y el resto se apaga. Los ocho primeros del tablero llevan color propio; los
 * demas van en gris hasta que se les aisla, y entonces toman el color de foco.
 *
 * El mapa de colores se arma una sola vez sobre la lista completa, asi que
 * aislar a alguien nunca repinta a los demas.
 */
export function CumulativeChart({ entries, days, brokers, dark }: Props) {
  const theme = chartTheme(dark)
  const [isolated, setIsolated] = useState<string | null>(null)

  const { data, ids, colorMap, nameById } = useMemo(() => {
    const idList = brokers.map((b) => b.id)
    return {
      data: cumulativePoints(entries, days, idList),
      ids: idList,
      colorMap: buildColorMap(idList, dark),
      nameById: new Map(brokers.map((b) => [b.id, b.name])),
    }
  }, [entries, days, brokers, dark])

  const nameOf = (key: string) => nameById.get(key) ?? key

  return (
    <div className="flex h-full flex-col gap-3 lg:flex-row">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 34 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortLabel}
              interval="preserveStartEnd"
              label={axisLabel('Dia de competencia', theme)}
              {...axisProps(theme)}
            />
            <YAxis
              allowDecimals={false}
              label={axisLabel('Puntos acumulados', theme, -90)}
              {...axisProps(theme)}
            />
            <Tooltip
              content={
                <ChartTooltip theme={theme} nameOf={nameOf} titleOf={(l) => longLabel(l)} />
              }
            />
            {ids.map((id) => {
              const muted = isolated !== null && isolated !== id
              const focused = isolated === id
              const color = focused ? theme.categorical[0] : colorMap[id]
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={nameOf(id)}
                  stroke={color}
                  strokeWidth={focused ? 3.5 : 2}
                  strokeOpacity={muted ? 0.12 : 1}
                  dot={false}
                  activeDot={muted ? false : { r: 4, strokeWidth: 2, stroke: theme.surface }}
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:w-56 lg:shrink-0">
        <p className="mb-2 text-xs font-semibold tracking-wide text-navy-600 uppercase dark:text-navy-300">
          Leyenda - clic para aislar
        </p>
        <ul className="flex max-h-64 flex-wrap gap-x-3 gap-y-1 overflow-y-auto lg:max-h-full lg:flex-col lg:flex-nowrap">
          {ids.map((id, index) => {
            const active = isolated === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setIsolated(active ? null : id)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors ${
                    active
                      ? 'bg-navy-100 font-semibold text-navy-950 dark:bg-navy-800 dark:text-white'
                      : 'text-navy-700 hover:bg-navy-100 dark:text-navy-200 dark:hover:bg-navy-800'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: active ? theme.categorical[0] : colorMap[id] }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{nameOf(id)}</span>
                  {index >= MAX_COLORED_SERIES && !active && (
                    <span className="sr-only">(sin color propio)</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        {isolated && (
          <button
            type="button"
            onClick={() => setIsolated(null)}
            className="mt-2 text-sm font-semibold text-navy-600 underline dark:text-navy-300"
          >
            Ver a todos
          </button>
        )}
      </div>
    </div>
  )
}
