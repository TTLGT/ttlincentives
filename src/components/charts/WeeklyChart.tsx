import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Broker, Entry } from '../../types'
import { pointsPerWeek } from '../../lib/scoring'
import { chartTheme } from '../../lib/palette'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  brokers: Broker[]
  dark: boolean
}

/**
 * Puntos por semana y por broker.
 *
 * Barras horizontales con el nombre completo a la izquierda: con 25 brokers es
 * la unica forma de que los nombres se lean sin girarlos. Cada semana es una
 * serie apilada.
 */
export function WeeklyChart({ entries, brokers, dark }: Props) {
  const theme = chartTheme(dark)

  const { data, weeks } = useMemo(() => {
    const ids = brokers.map((b) => b.id)
    const perWeek = pointsPerWeek(entries, ids)
    const weekKeys = perWeek.map((row) => String(row.week))

    const rows = brokers.map((broker) => {
      const row: Record<string, number | string> = { name: broker.name, id: broker.id }
      let total = 0
      for (const weekRow of perWeek) {
        const value = Number(weekRow[broker.id] ?? 0)
        row[String(weekRow.week)] = value
        total += value
      }
      row.total = total
      return row
    })

    rows.sort((a, b) => Number(b.total) - Number(a.total))
    return { data: rows, weeks: weekKeys }
  }, [entries, brokers])

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 30 }}>
        <CartesianGrid stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          label={axisLabel('Puntos', theme)}
          {...axisProps(theme)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          interval={0}
          tick={{ fill: theme.textMuted, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.axis }}
        />
        <Tooltip
          cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,37,69,0.06)' }}
          content={<ChartTooltip theme={theme} formatValue={(v) => `${v} pts`} />}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: theme.textMuted, fontSize: 13 }}>{String(value)}</span>
          )}
          wrapperStyle={{ paddingTop: 6 }}
        />
        {weeks.map((week, index) => (
          <Bar
            key={week}
            dataKey={week}
            name={week}
            stackId="semana"
            fill={theme.categorical[index % theme.categorical.length]}
            stroke={theme.surface}
            strokeWidth={2}
            radius={[0, 4, 4, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
