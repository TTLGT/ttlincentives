import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Entry } from '../../types'
import { approvedEntries, pointsOf } from '../../lib/scoring'
import { chartTheme } from '../../lib/palette'
import { longLabel, shortLabel } from '../../lib/dates'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  brokerId: string
  days: string[]
  dark: boolean
}

/** Dia a dia de un broker: oportunidades validadas y puntos del dia. */
export function BrokerDailyChart({ entries, brokerId, days, dark }: Props) {
  const theme = chartTheme(dark)

  const data = useMemo(() => {
    const opportunities = new Map<string, number>()
    const points = new Map<string, number>()
    for (const entry of approvedEntries(entries)) {
      if (entry.brokerId !== brokerId) continue
      points.set(entry.date, (points.get(entry.date) ?? 0) + pointsOf(entry))
      if (entry.kind === 'opportunity') {
        opportunities.set(entry.date, (opportunities.get(entry.date) ?? 0) + 1)
      }
    }
    return days.map((date) => ({
      date,
      oportunidades: opportunities.get(date) ?? 0,
      puntos: points.get(date) ?? 0,
    }))
  }, [entries, brokerId, days])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 34 }} barGap={2}>
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
          label={axisLabel('Cantidad', theme, -90)}
          {...axisProps(theme)}
        />
        <Tooltip
          cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,37,69,0.06)' }}
          content={<ChartTooltip theme={theme} hideZeros={false} titleOf={(l) => longLabel(l)} />}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: theme.textMuted, fontSize: 13 }}>{String(value)}</span>
          )}
          wrapperStyle={{ paddingTop: 8 }}
        />
        <Bar
          dataKey="oportunidades"
          name="Oportunidades validadas"
          fill={theme.categorical[0]}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="puntos"
          name="Puntos del dia"
          fill={theme.categorical[1]}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
