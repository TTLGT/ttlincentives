import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMemo } from 'react'
import type { Broker, Entry } from '../../types'
import { opportunitiesPerDay } from '../../lib/scoring'
import { buildColorMap, chartTheme, MAX_COLORED_SERIES } from '../../lib/palette'
import { longLabel, shortLabel } from '../../lib/dates'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  days: string[]
  /** Brokers en orden de tablero: define que ocho llevan color propio. */
  brokers: Broker[]
  /** 'all' apila a todos; un id muestra solo a ese broker. */
  selected: string
  dark: boolean
}

const OTHERS_KEY = '__otros__'

/**
 * Oportunidades validadas por dia.
 *
 * Con todos los brokers apilados solo los ocho primeros llevan color propio; el
 * resto se suma en una sola banda gris "Otros". Dos docenas de colores en una
 * barra apilada no se distinguen ni de cerca, menos en la TV.
 */
export function OpportunitiesChart({ entries, days, brokers, selected, dark }: Props) {
  const theme = chartTheme(dark)

  const { data, series, colors, nameOf } = useMemo(() => {
    const ids = brokers.map((b) => b.id)
    const nameById = new Map(brokers.map((b) => [b.id, b.name]))
    const colorMap = buildColorMap(ids, dark)
    const rows = opportunitiesPerDay(entries, days, ids)

    if (selected !== 'all') {
      return {
        data: rows.map((row) => ({ date: row.date, [selected]: row[selected] ?? 0 })),
        series: [selected],
        colors: { [selected]: colorMap[selected] ?? theme.categorical[0] },
        nameOf: (key: string) => nameById.get(key) ?? key,
      }
    }

    const colored = ids.slice(0, MAX_COLORED_SERIES)
    const rest = ids.slice(MAX_COLORED_SERIES)
    const stacked = rows.map((row) => {
      const out: Record<string, number | string> = { date: row.date }
      for (const id of colored) out[id] = Number(row[id] ?? 0)
      out[OTHERS_KEY] = rest.reduce((sum, id) => sum + Number(row[id] ?? 0), 0)
      return out
    })

    const keys = rest.length > 0 ? [...colored, OTHERS_KEY] : colored
    const colorsOut: Record<string, string> = { [OTHERS_KEY]: theme.other }
    for (const id of colored) colorsOut[id] = colorMap[id]

    return {
      data: stacked,
      series: keys,
      colors: colorsOut,
      nameOf: (key: string) =>
        key === OTHERS_KEY ? `Otros (${rest.length} brokers)` : (nameById.get(key) ?? key),
    }
  }, [entries, days, brokers, selected, dark, theme])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 34 }}>
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
          label={axisLabel('Oportunidades validadas', theme, -90)}
          {...axisProps(theme)}
        />
        <Tooltip
          cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,37,69,0.06)' }}
          content={
            <ChartTooltip theme={theme} nameOf={nameOf} titleOf={(l) => longLabel(l)} />
          }
        />
        {series.length > 1 && (
          <Legend
            formatter={(value) => (
              <span style={{ color: theme.textMuted, fontSize: 13 }}>{nameOf(String(value))}</span>
            )}
            wrapperStyle={{ paddingTop: 8 }}
          />
        )}
        {series.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="dia"
            fill={colors[key]}
            // Separacion de 2px entre segmentos apilados.
            stroke={theme.surface}
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={54}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
