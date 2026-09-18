import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Entry } from '../../types'
import { sourceBreakdown } from '../../lib/scoring'
import { chartTheme } from '../../lib/palette'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  entries: Entry[]
  /** Si viene, el desglose es solo de ese broker. */
  brokerId?: string
  dark: boolean
}

/**
 * De donde vienen las oportunidades: la columna "Load's Source" del formulario.
 *
 * Es una sola serie, asi que no lleva leyenda; el valor va escrito al final de
 * cada barra, que ademas es el "relief" que pide la validacion de contraste.
 */
export function SourceChart({ entries, brokerId, dark }: Props) {
  const theme = chartTheme(dark)
  const data = sourceBreakdown(entries, brokerId)

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-navy-500 dark:text-navy-400">
        Todavia no hay oportunidades validadas con fuente registrada. Se llena sola
        cuando entren las respuestas del formulario.
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
          label={axisLabel('Oportunidades validadas', theme)}
          {...axisProps(theme)}
        />
        <YAxis
          type="category"
          dataKey="source"
          width={150}
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
              nameOf={() => 'Oportunidades'}
              formatValue={(v) => String(v)}
            />
          }
        />
        <Bar dataKey="count" name="Oportunidades" radius={[0, 4, 4, 0]} maxBarSize={30}>
          {data.map((row, index) => (
            <Cell
              key={row.source}
              fill={theme.categorical[index % theme.categorical.length]}
              stroke={theme.surface}
              strokeWidth={2}
            />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: theme.text, fontSize: 13, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
