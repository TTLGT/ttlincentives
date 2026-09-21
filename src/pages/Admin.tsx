import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Fish, Pencil, Plus, RefreshCw, Save, Trash2, X, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useCompetition } from '../hooks/useCompetition'
import { StatusPill } from '../components/StatusPill'
import {
  bigFishOfDay,
  ENTRY_KINDS,
  KIND_LABELS,
  KIND_SHORT_LABELS,
  POINTS_BY_KIND,
  scores,
} from '../lib/scoring'
import { longLabel, shortLabel } from '../lib/dates'
import { money, moneyExact } from '../lib/format'
import {
  BIG_FISH_MIN_FEE,
  COMPETITION_END,
  COMPETITION_START,
} from '../config/competition'
import { describeImport, runImportNow } from '../lib/importNow'
import type { Entry, EntryDraft, EntryKind, EntryStatus } from '../types'

/** Estado vacio del formulario, con la fecha de hoy en Guatemala. */
function emptyDraft(date: string): EntryDraft {
  return {
    brokerId: '',
    date,
    kind: 'opportunity',
    points: POINTS_BY_KIND.opportunity,
    quoteSent: false,
    brokerFee: 0,
    feeCollected: false,
    status: 'approved',
    note: '',
  }
}

export function Admin() {
  const { isAdmin, user } = useAuth()
  const { todayGt, standings } = useCompetition()
  const { brokers, entries, addEntry, updateEntry, setEntryStatus, deleteEntry } = useData()

  const [draft, setDraft] = useState<EntryDraft>(() => emptyDraft(todayGt))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  /**
   * Trae las respuestas del formulario a mano. No hace falta refrescar la
   * pagina despues: el tablero escucha Firestore y se actualiza solo.
   */
  async function importNow(dryRun: boolean) {
    setImporting(true)
    setMessage(null)
    setFailure(null)
    try {
      setMessage(describeImport(await runImportNow(dryRun)))
    } catch (err) {
      setFailure((err as { message?: string })?.message ?? 'No se pudo importar.')
    } finally {
      setImporting(false)
    }
  }

  // Segunda revision del lado del navegador. La de verdad esta en firestore.rules.
  if (!isAdmin) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-bold text-navy-950 dark:text-white">Panel restringido</p>
        <p className="mt-2 text-sm text-navy-600 dark:text-navy-300">
          Solo las cuentas de administracion pueden entrar aqui.
        </p>
        <Link to="/" className="btn-primary mt-4">
          Volver al tablero
        </Link>
      </div>
    )
  }

  const brokerName = (id: string) => brokers.find((b) => b.id === id)?.name ?? id

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(true)
    setFailure(null)
    setMessage(null)
    try {
      await action()
      setMessage(label)
    } catch (err) {
      setFailure(describe(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.brokerId) {
      setFailure('Elegi un broker.')
      return
    }
    if (editingId) {
      const id = editingId
      await run('Entrada actualizada.', async () => {
        await updateEntry(id, draft)
        setEditingId(null)
        setDraft(emptyDraft(todayGt))
      })
    } else {
      await run('Entrada agregada.', async () => {
        await addEntry(draft)
        setDraft({ ...emptyDraft(todayGt), date: draft.date, brokerId: draft.brokerId })
      })
    }
  }

  const quickAdd = (brokerId: string) =>
    run(`Oportunidad registrada para ${brokerName(brokerId)}.`, () =>
      addEntry({ ...emptyDraft(todayGt), brokerId }),
    )

  const startEdit = (entry: Entry) => {
    setEditingId(entry.id)
    setDraft({
      brokerId: entry.brokerId,
      date: entry.date,
      kind: entry.kind,
      points: entry.points,
      quoteSent: entry.quoteSent,
      brokerFee: entry.brokerFee,
      feeCollected: entry.feeCollected,
      status: entry.status,
      note: entry.note,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pending = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'pending')
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries],
  )

  const recent = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 40),
    [entries],
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-950 sm:text-3xl dark:text-white">Panel de administracion</h1>
        <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
          Sesion: {user?.email}. Cada cambio queda registrado con tu correo y la hora.
        </p>
        <p className="mt-1 text-sm font-semibold text-navy-800 dark:text-navy-200">
          No escribas datos de cliente en las notas: ni nombres, ni telefonos, ni direcciones.
        </p>
      </header>

      {(message || failure) && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            failure
              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          }`}
        >
          {failure ?? message}
        </p>
      )}

      <ImportPanel busy={importing} onRun={importNow} />

      <QuickAdd brokers={brokers} onAdd={quickAdd} busy={busy} today={todayGt} />

      <EntryForm
        draft={draft}
        setDraft={setDraft}
        brokers={brokers}
        editing={editingId !== null}
        busy={busy}
        onSubmit={submit}
        onCancel={() => {
          setEditingId(null)
          setDraft(emptyDraft(todayGt))
        }}
      />

      <PendingQueue
        pending={pending}
        brokerName={brokerName}
        busy={busy}
        onApprove={(id) => run('Entrada validada.', () => setEntryStatus(id, 'approved'))}
        onReject={(id) => run('Entrada rechazada.', () => setEntryStatus(id, 'rejected'))}
      />

      <BigFishPanel
        entries={entries}
        brokerName={brokerName}
        defaultDate={todayGt}
        busy={busy}
        onMark={(brokerId, date, fee) =>
          run(`Big Fish marcado para ${brokerName(brokerId)}.`, () =>
            addEntry({
              ...emptyDraft(date),
              brokerId,
              kind: 'big_fish',
              points: POINTS_BY_KIND.big_fish,
              brokerFee: fee,
              feeCollected: true,
              note: 'Big Fish del dia',
            }),
          )
        }
      />

      <RecentEntries
        entries={recent}
        brokerName={brokerName}
        busy={busy}
        onEdit={startEdit}
        onDelete={(id) => run('Entrada borrada.', () => deleteEntry(id))}
      />

      <p className="text-xs text-navy-500 dark:text-navy-400">
        Brokers cargados: {standings.length}. Entradas totales: {entries.length}.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * El boton "Actualizar ahora".
 *
 * El navegador no lee el Google Sheet: la hoja tiene datos de cliente y es
 * privada. Esto le pide a una Cloud Function que corra la importacion del lado
 * del servidor. Lo mismo que hace GitHub Actions cada 10 minutos, pero cuando
 * uno no quiere esperar.
 */
function ImportPanel({ busy, onRun }: { busy: boolean; onRun: (dryRun: boolean) => void }) {
  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy-950 dark:text-white">
        <RefreshCw size={18} className={busy ? 'animate-spin' : undefined} />
        Respuestas del formulario
      </h2>
      <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
        Se importan solas cada 10 minutos. Usa este boton si no quieres esperar.
        Las filas con la casilla <strong>Approved</strong> marcada entran validadas; el resto
        cae en la cola de validacion.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => onRun(false)} disabled={busy}>
          <RefreshCw size={16} className={busy ? 'animate-spin' : undefined} />
          {busy ? 'Importando...' : 'Actualizar ahora'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => onRun(true)} disabled={busy}>
          Solo ver que haria
        </button>
      </div>
    </section>
  )
}

function QuickAdd({
  brokers,
  onAdd,
  busy,
  today,
}: {
  brokers: { id: string; name: string }[]
  onAdd: (brokerId: string) => void
  busy: boolean
  today: string
}) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy-950 dark:text-white">
        <Zap className="h-5 w-5" aria-hidden="true" />
        Registro rapido
      </h2>
      <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
        Un clic = una oportunidad nueva validada, con fecha de hoy ({longLabel(today)}).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {brokers.map((broker) => (
          <button
            key={broker.id}
            type="button"
            disabled={busy}
            onClick={() => onAdd(broker.id)}
            className="btn-ghost px-3 py-1.5 text-xs sm:text-sm"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {broker.name}
          </button>
        ))}
        {brokers.length === 0 && (
          <p className="text-sm text-navy-500">No hay brokers cargados todavia.</p>
        )}
      </div>
    </section>
  )
}

function EntryForm({
  draft,
  setDraft,
  brokers,
  editing,
  busy,
  onSubmit,
  onCancel,
}: {
  draft: EntryDraft
  setDraft: (draft: EntryDraft) => void
  brokers: { id: string; name: string }[]
  editing: boolean
  busy: boolean
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}) {
  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) =>
    setDraft({ ...draft, [key]: value })

  // Al cambiar el tipo, los puntos se rellenan solos pero quedan editables.
  const changeKind = (kind: EntryKind) =>
    setDraft({ ...draft, kind, points: POINTS_BY_KIND[kind] })

  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-bold text-navy-950 dark:text-white">
        {editing ? 'Editar entrada' : 'Agregar entrada'}
      </h2>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="label">Broker</span>
          <select
            className="field"
            value={draft.brokerId}
            onChange={(e) => set('brokerId', e.target.value)}
            required
          >
            <option value="">Elegir broker...</option>
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Fecha (hora de Guatemala)</span>
          <input
            type="date"
            className="field"
            value={draft.date}
            min={COMPETITION_START}
            max={COMPETITION_END}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="label">Tipo</span>
          <select
            className="field"
            value={draft.kind}
            onChange={(e) => changeKind(e.target.value as EntryKind)}
          >
            {ENTRY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]} ({POINTS_BY_KIND[kind] >= 0 ? '+' : ''}
                {POINTS_BY_KIND[kind]})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Puntos</span>
          <input
            type="number"
            className="field"
            value={draft.points}
            step={1}
            onChange={(e) => set('points', Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="label">Broker fee (USD)</span>
          <input
            type="number"
            className="field"
            value={draft.brokerFee}
            min={0}
            step="0.01"
            onChange={(e) => set('brokerFee', Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="label">Estado</span>
          <select
            className="field"
            value={draft.status}
            onChange={(e) => set('status', e.target.value as EntryStatus)}
          >
            <option value="approved">Validada (puntea)</option>
            <option value="pending">Pendiente (no puntea)</option>
            <option value="rejected">Rechazada (no puntea)</option>
          </select>
        </label>

        <div className="flex flex-col justify-center gap-2 sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-2 text-sm text-navy-800 dark:text-navy-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-navy-400"
              checked={draft.feeCollected}
              onChange={(e) => set('feeCollected', e.target.checked)}
            />
            Fee ya cobrado (cuenta para los $2,000)
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-800 dark:text-navy-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-navy-400"
              checked={draft.quoteSent}
              onChange={(e) => set('quoteSent', e.target.checked)}
            />
            Cotizacion enviada (desempate Fase 1)
          </label>
        </div>

        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="label">Nota (sin datos de cliente)</span>
          <input
            type="text"
            className="field"
            value={draft.note}
            maxLength={280}
            placeholder="Nota corta para el equipo"
            onChange={(e) => set('note', e.target.value)}
          />
        </label>

        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {editing ? 'Guardar cambios' : 'Agregar entrada'}
          </button>
          {editing && (
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

function PendingQueue({
  pending,
  brokerName,
  busy,
  onApprove,
  onReject,
}: {
  pending: Entry[]
  brokerName: (id: string) => string
  busy: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-bold text-navy-950 dark:text-white">
        Cola de validacion ({pending.length})
      </h2>
      <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
        Mientras esten pendientes no suman nada.
      </p>

      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-navy-600 dark:text-navy-300">No hay nada pendiente.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {pending.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-200 p-3 dark:border-navy-800"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-950 dark:text-white">
                  {brokerName(entry.brokerId)}
                </p>
                <p className="text-sm text-navy-600 dark:text-navy-300">
                  {shortLabel(entry.date)} - {KIND_SHORT_LABELS[entry.kind]} - {entry.points} pts
                  {entry.brokerFee > 0 && ` - ${moneyExact(entry.brokerFee)}`}
                </p>
                {entry.note && (
                  <p className="text-xs text-navy-500 dark:text-navy-400">{entry.note}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={busy}
                  onClick={() => onApprove(entry.id)}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Validar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => onReject(entry.id)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function BigFishPanel({
  entries,
  brokerName,
  defaultDate,
  busy,
  onMark,
}: {
  entries: Entry[]
  brokerName: (id: string) => string
  defaultDate: string
  busy: boolean
  onMark: (brokerId: string, date: string, fee: number) => void
}) {
  const [date, setDate] = useState(defaultDate)

  const current = bigFishOfDay(entries, date)

  // Candidatos: entradas validadas de ese dia con fee sobre el minimo.
  const candidates = entries
    .filter(
      (e) =>
        e.date === date && scores(e) && e.kind !== 'big_fish' && e.brokerFee > BIG_FISH_MIN_FEE,
    )
    .sort((a, b) => b.brokerFee - a.brokerFee)

  return (
    <section className="card p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy-950 dark:text-white">
        <Fish className="h-5 w-5" aria-hidden="true" />
        Big Fish del dia
      </h2>
      <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">
        El mayor broker fee cerrado del dia, siempre que pase de {money(BIG_FISH_MIN_FEE)}. Suma +2
        puntos y Q50 en efectivo. Corre del 24 al 30 de septiembre.
      </p>

      <label className="mt-4 block max-w-xs">
        <span className="label">Dia</span>
        <input
          type="date"
          className="field"
          value={date}
          min={COMPETITION_START}
          max={COMPETITION_END}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      {current && (
        <p className="mt-3 rounded-lg bg-gold-500/15 px-3 py-2 text-sm font-semibold text-navy-900 dark:text-gold-400">
          Ya marcado: {brokerName(current.brokerId)} con {moneyExact(current.brokerFee)}.
        </p>
      )}

      {candidates.length === 0 ? (
        <p className="mt-4 text-sm text-navy-600 dark:text-navy-300">
          Ese dia no hay cierres validados con fee sobre {money(BIG_FISH_MIN_FEE)}.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {candidates.slice(0, 8).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-200 p-3 dark:border-navy-800"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-950 dark:text-white">
                  {brokerName(entry.brokerId)}
                </p>
                <p className="tnum text-sm text-navy-600 dark:text-navy-300">
                  {moneyExact(entry.brokerFee)} - {KIND_SHORT_LABELS[entry.kind]}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => onMark(entry.brokerId, entry.date, entry.brokerFee)}
              >
                <Fish className="h-4 w-4" aria-hidden="true" />
                Marcar Big Fish
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentEntries({
  entries,
  brokerName,
  busy,
  onEdit,
  onDelete,
}: {
  entries: Entry[]
  brokerName: (id: string) => string
  busy: boolean
  onEdit: (entry: Entry) => void
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-navy-200 px-4 py-3 sm:px-6 dark:border-navy-800">
        <h2 className="text-lg font-bold text-navy-950 dark:text-white">Ultimos movimientos</h2>
      </div>
      {entries.length === 0 ? (
        <p className="px-6 py-8 text-center text-navy-600 dark:text-navy-300">
          Todavia no hay entradas.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-navy-50 text-xs tracking-wide text-navy-600 uppercase dark:bg-navy-950/60 dark:text-navy-300">
              <tr>
                <th scope="col" className="px-4 py-2.5 sm:px-6">Broker</th>
                <th scope="col" className="px-4 py-2.5">Fecha</th>
                <th scope="col" className="px-4 py-2.5">Tipo</th>
                <th scope="col" className="px-4 py-2.5 text-right">Pts</th>
                <th scope="col" className="px-4 py-2.5 text-right">Fee</th>
                <th scope="col" className="px-4 py-2.5">Estado</th>
                <th scope="col" className="px-4 py-2.5">Registro</th>
                <th scope="col" className="px-4 py-2.5 sm:px-6"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2.5 font-semibold text-navy-950 sm:px-6 dark:text-white">
                    {brokerName(entry.brokerId)}
                  </td>
                  <td className="tnum px-4 py-2.5 whitespace-nowrap">{shortLabel(entry.date)}</td>
                  <td className="px-4 py-2.5">{KIND_SHORT_LABELS[entry.kind]}</td>
                  <td className="tnum px-4 py-2.5 text-right">{entry.points}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {entry.brokerFee > 0 ? moneyExact(entry.brokerFee) : '-'}
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={entry.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-navy-500 dark:text-navy-400">
                    {entry.updatedBy || entry.createdBy}
                    <br />
                    {(entry.updatedAt || entry.createdAt).slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2.5 sm:px-6">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded p-1.5 text-navy-600 hover:bg-navy-100 dark:text-navy-300 dark:hover:bg-navy-800"
                        onClick={() => onEdit(entry)}
                        aria-label={`Editar entrada de ${brokerName(entry.brokerId)}`}
                        disabled={busy}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {confirming === entry.id ? (
                        <>
                          <button
                            type="button"
                            className="btn-danger px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => {
                              onDelete(entry.id)
                              setConfirming(null)
                            }}
                          >
                            Borrar
                          </button>
                          <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => setConfirming(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          onClick={() => setConfirming(entry.id)}
                          aria-label={`Borrar entrada de ${brokerName(entry.brokerId)}`}
                          disabled={busy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function describe(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code === 'permission-denied') {
    return 'Firestore rechazo la escritura. Revisa que las reglas esten desplegadas y que tu correo sea admin.'
  }
  return (err as { message?: string })?.message ?? 'No se pudo guardar.'
}
