/** Piezas compartidas por todas las graficas: tooltip, ejes y leyenda. */

import type { ChartTheme } from '../../lib/palette'
import { money } from '../../lib/format'

export interface TooltipEntry {
  name?: string
  dataKey?: string | number
  value?: number | string
  color?: string
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  theme: ChartTheme
  /** Traduce la clave de la serie a un nombre legible. */
  nameOf?: (key: string) => string
  formatValue?: (value: number) => string
  /** Oculta las series en cero, que con todo el roster son casi todas. */
  hideZeros?: boolean
  titleOf?: (label: string) => string
}

export function ChartTooltip({
  active,
  payload,
  label,
  theme,
  nameOf,
  formatValue,
  hideZeros = true,
  titleOf,
}: TooltipProps) {
  if (!active || !payload?.length) return null

  const rows = payload
    .filter((row) => !hideZeros || Number(row.value) !== 0)
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 12)

  if (rows.length === 0) return null

  const format = formatValue ?? ((v: number) => String(v))
  const heading = titleOf ? titleOf(String(label)) : String(label)

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{
        background: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        color: theme.text,
      }}
    >
      <p className="mb-1 font-semibold">{heading}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={String(row.dataKey)} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: row.color }}
              aria-hidden="true"
            />
            <span className="mr-3 truncate" style={{ color: theme.textMuted }}>
              {nameOf ? nameOf(String(row.dataKey)) : (row.name ?? String(row.dataKey))}
            </span>
            <span className="tnum ml-auto font-semibold">{format(Number(row.value))}</span>
          </li>
        ))}
      </ul>
      {payload.length > rows.length && (
        <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>
          y {payload.length - rows.length} mas
        </p>
      )}
    </div>
  )
}

export const moneyTick = (value: number) => money(value)

/** Estilos de eje compartidos: tipografia grande y cromo discreto. */
export function axisProps(theme: ChartTheme) {
  return {
    tick: { fill: theme.textMuted, fontSize: 13 },
    tickLine: false,
    axisLine: { stroke: theme.axis },
  } as const
}

export const AXIS_LABEL_SIZE = 13

export function axisLabel(text: string, theme: ChartTheme, angle?: number) {
  return {
    value: text,
    angle,
    position: angle ? ('insideLeft' as const) : ('insideBottom' as const),
    offset: angle ? 10 : -8,
    style: {
      fill: theme.textMuted,
      fontSize: AXIS_LABEL_SIZE,
      fontWeight: 600,
      textAnchor: 'middle' as const,
    },
  }
}
