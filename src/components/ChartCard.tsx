import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  /** Controles (filtros, toggles) que van en la fila de arriba. */
  controls?: ReactNode
  /** Alto del area de dibujo. Generoso: esto se ve en una TV. */
  height?: number
  children: ReactNode
  footnote?: ReactNode
}

export function ChartCard({ title, subtitle, controls, height = 340, children, footnote }: Props) {
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy-950 sm:text-xl dark:text-white">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">{subtitle}</p>
          )}
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
      {footnote && (
        <p className="mt-3 text-xs text-navy-500 dark:text-navy-400">{footnote}</p>
      )}
    </section>
  )
}
