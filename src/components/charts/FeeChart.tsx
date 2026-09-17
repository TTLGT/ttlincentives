import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BrokerStanding } from '../../lib/scoring'
import { feeByBroker } from '../../lib/scoring'
import { chartTheme } from '../../lib/palette'
import { money } from '../../lib/format'
import { QUALIFY_FEE_FLOOR } from '../../config/competition'
import { axisLabel, axisProps, ChartTooltip } from './chartBits'

interface Props {
  standings: BrokerStanding[]
  dark: boolean
}

/**
 * Broker fee por broker: cobrado y pendiente, lado a lado.
 *
 * Los montos son visibles para toda persona con sesion aprobada. Es a
 * proposito y el equipo lo acordo: no hay filtro por rol aqui.
 *
 * La linea vertical marca el piso de $2,000 que hay que cobrar para calificar.
 */
export function FeeChart({ standings, dark }: Props) {
  const theme = chartTheme(dark)
  const data = feeByBroker(standings)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 30 }}>
        <CartesianGrid stroke={theme.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => money(Number(v))}
          label={axisLabel('Broker fee (USD)', theme)}
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
          content={<ChartTooltip theme={theme} formatValue={(v) => money(v)} hideZeros={false} />}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: theme.textMuted, fontSize: 13 }}>{String(value)}</span>
          )}
          wrapperStyle={{ paddingTop: 6 }}
        />
        <ReferenceLine
          x={QUALIFY_FEE_FLOOR}
          stroke={theme.textMuted}
          strokeDasharray="4 4"
          label={{
            value: `Piso ${money(QUALIFY_FEE_FLOOR)}`,
            position: 'top',
            fill: theme.textMuted,
            fontSize: 12,
            fontWeight: 600,
          }}
        />
        <Bar
          dataKey="cobrado"
          name="Cobrado"
          stackId="fee"
          fill={theme.categorical[0]}
          stroke={theme.surface}
          strokeWidth={2}
        />
        <Bar
          dataKey="pendiente"
          name="Pendiente de cobro"
          stackId="fee"
          fill={theme.categorical[3]}
          stroke={theme.surface}
          strokeWidth={2}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
