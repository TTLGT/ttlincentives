import { CheckCircle2, CircleAlert } from 'lucide-react'
import { money, progressPct } from '../lib/format'
import type { Qualification } from '../lib/scoring'

/**
 * Estado de calificacion al premio final: piso de fee cobrado y minimo de
 * cargas. El color nunca va solo: siempre lleva icono y texto.
 */
export function QualificationBadge({ q, compact = false }: { q: Qualification; compact?: boolean }) {
  const Icon = q.qualified ? CheckCircle2 : CircleAlert

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          q.qualified
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
        }`}
        title={`Fee cobrado ${money(q.feeCollected)} de ${money(q.feeRequired)} - Cargas ${q.loads} de ${q.loadsRequired}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {q.qualified ? 'Califica' : 'No califica'}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
          q.qualified
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {q.qualified ? 'Califica al premio final' : 'No califica todavia'}
      </div>

      <Meter
        label="Broker fee cobrado"
        current={money(q.feeCollected)}
        target={money(q.feeRequired)}
        pct={progressPct(q.feeCollected, q.feeRequired)}
        met={q.feeMet}
      />
      <Meter
        label="Cargas nuevas (1 por dia)"
        current={String(q.loads)}
        target={String(q.loadsRequired)}
        pct={progressPct(q.loads, q.loadsRequired)}
        met={q.loadsMet}
      />
    </div>
  )
}

function Meter({
  label,
  current,
  target,
  pct,
  met,
}: {
  label: string
  current: string
  target: string
  pct: number
  met: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-navy-700 dark:text-navy-200">{label}</span>
        <span className="tnum font-semibold text-navy-950 dark:text-white">
          {current} <span className="text-navy-500 dark:text-navy-300">/ {target}</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-navy-200 dark:bg-navy-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${met ? 'bg-emerald-600' : 'bg-navy-500 dark:bg-navy-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
