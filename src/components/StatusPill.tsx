import { Check, Clock, X } from 'lucide-react'
import type { EntryStatus } from '../types'

const CONFIG: Record<EntryStatus, { label: string; icon: typeof Check; className: string }> = {
  approved: {
    label: 'Validada',
    icon: Check,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  pending: {
    label: 'Pendiente',
    icon: Clock,
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  rejected: {
    label: 'Rechazada',
    icon: X,
    className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
}

/** Estado de una entrada. Nunca se apoya solo en el color: lleva icono y texto. */
export function StatusPill({ status }: { status: EntryStatus }) {
  const { label, icon: Icon, className } = CONFIG[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
