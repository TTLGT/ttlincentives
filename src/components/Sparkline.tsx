import { shortLabel } from '../lib/dates'

interface Props {
  data: Array<{ date: string; value: number }>
  /** Escala compartida entre filas para que las alturas sean comparables. */
  max: number
}

/**
 * Ultimos 7 dias de un broker, en barras.
 *
 * Va en SVG a mano y no en Recharts: son 25 filas y una grafica completa por
 * fila pesa demasiado para la vista de TV. Las barras se comparan entre filas
 * porque todas usan la misma escala `max`.
 */
export function Sparkline({ data, max }: Props) {
  const width = 76
  const height = 26
  const gap = 2
  const barWidth = (width - gap * (data.length - 1)) / data.length
  const scale = Math.max(1, max)
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Ultimos ${data.length} dias: ${total} puntos`}
      className="overflow-visible"
    >
      {data.map((d, i) => {
        const h = d.value === 0 ? 2 : Math.max(3, (d.value / scale) * (height - 3))
        return (
          <rect
            key={d.date}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            rx={2}
            className={d.value === 0 ? 'fill-navy-200 dark:fill-navy-800' : 'fill-navy-500 dark:fill-navy-300'}
          >
            <title>{`${shortLabel(d.date)}: ${d.value} pts`}</title>
          </rect>
        )
      })}
    </svg>
  )
}
