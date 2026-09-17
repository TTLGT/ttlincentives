import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Entry } from '../../types'
import { pointsBreakdown } from '../../lib/scoring'
import { chartTheme } from '../../lib/palette'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  /** Si viene, el desglose es solo de ese broker. */
  brokerId?: string
  dark: boolean
}

/**
 * De donde salen los puntos: cold calls, referidos, primeros cierres, etc.
 *
 * Una sola serie, asi que no lleva leyenda; el valor va escrito al final de
 * cada barra, que ademas es el "relief" que pide la validacion de contraste.
 */
export function BreakdownChart({ entries, brokerId, dark }: Props) {
  const theme = chartTheme(dark)
  const data = pointsBreakdown(entries, brokerId).sort((a, b) => b.points - a.points)

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-navy-500 dark:text-navy-400">
        Todavia no hay entradas validadas.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 30 }}>
        <CartesianGrid stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          label={axisLabel('Puntos', theme)}
          {...axisProps(theme)}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={180}
          interval={0}
          tick={{ fill: theme.textMuted, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: theme.axis }}
        />
        <Tooltip
          cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(11,37,69,0.06)' }}
          content={
            <ChartTooltip
              theme={theme}
              hideZeros={false}
              formatValue={(v) => `${v} pts`}
              nameOf={() => 'Puntos'}
            />
          }
        />
        <Bar dataKey="points" name="Puntos" radius={[0, 4, 4, 0]} maxBarSize={30}>
          {data.map((row, index) => (
            <Cell
              key={row.kind}
              fill={theme.categorical[index % theme.categorical.length]}
              stroke={theme.surface}
              strokeWidth={2}
            />
          ))}
          <LabelList
            dataKey="points"
            position="right"
            style={{ fill: theme.text, fontSize: 13, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
