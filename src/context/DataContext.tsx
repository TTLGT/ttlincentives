/**
 * Datos en vivo desde Firestore.
 *
 * Se suscribe a brokers, entries y comments mientras haya sesion aprobada.
 * Si la sesion se cae o el correo no esta en la lista blanca, se sueltan las
 * suscripciones y se vacia el estado: nada queda en pantalla.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '../lib/firebase'
import { useAuth } from './AuthContext'
import type { Broker, Comment, Entry, EntryDraft, EntryStatus } from '../types'

interface DataValue {
  brokers: Broker[]
  entries: Entry[]
  comments: Comment[]
  loading: boolean
  error: string | null
  addEntry: (draft: EntryDraft) => Promise<void>
  updateEntry: (id: string, patch: Partial<EntryDraft>) => Promise<void>
  setEntryStatus: (id: string, status: EntryStatus) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  addComment: (brokerId: string, text: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
}

const noop = async () => {}

export const DataContext = createContext<DataValue>({
  brokers: [],
  entries: [],
  comments: [],
  loading: true,
  error: null,
  addEntry: noop,
  updateEntry: noop,
  setEntryStatus: noop,
  deleteEntry: noop,
  addComment: noop,
  deleteComment: noop,
})

export function DataProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const ready = status === 'ready'

  const [brokers, setBrokers] = useState<Broker[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) {
      setBrokers([])
      setEntries([])
      setComments([])
      setLoading(false)
      return
    }

    setLoading(true)
    const fail = (err: unknown) => setError((err as { message?: string })?.message ?? 'Error de lectura')

    const stopBrokers = onSnapshot(
      collection(db, COLLECTIONS.brokers),
      (snap) => {
        setBrokers(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Broker, 'id'>) }))
            .filter((b) => b.active !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
        setLoading(false)
      },
      fail,
    )

    const stopEntries = onSnapshot(
      collection(db, COLLECTIONS.entries),
      (snap) => setEntries(snap.docs.map((d) => normalizeEntry(d.id, d.data()))),
      fail,
    )

    const stopComments = onSnapshot(
      collection(db, COLLECTIONS.comments),
      (snap) =>
        setComments(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }))
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        ),
      fail,
    )

    return () => {
      stopBrokers()
      stopEntries()
      stopComments()
    }
  }, [ready])

  const actorEmail = user?.email?.toLowerCase() ?? ''
  const actorName = user?.displayName ?? actorEmail

  const addEntry = useCallback(
    async (draft: EntryDraft) => {
      const now = new Date().toISOString()
      await addDoc(collection(db, COLLECTIONS.entries), {
        ...sanitize(draft),
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      })
    },
    [actorEmail],
  )

  const updateEntry = useCallback(
    async (id: string, patch: Partial<EntryDraft>) => {
      await updateDoc(doc(db, COLLECTIONS.entries, id), {
        ...patch,
        updatedBy: actorEmail,
        updatedAt: new Date().toISOString(),
      })
    },
    [actorEmail],
  )

  const setEntryStatus = useCallback(
    async (id: string, entryStatus: EntryStatus) => {
      await updateDoc(doc(db, COLLECTIONS.entries, id), {
        status: entryStatus,
        updatedBy: actorEmail,
        updatedAt: new Date().toISOString(),
      })
    },
    [actorEmail],
  )

  const deleteEntry = useCallback(async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.entries, id))
  }, [])

  const addComment = useCallback(
    async (brokerId: string, text: string) => {
      await addDoc(collection(db, COLLECTIONS.comments), {
        brokerId,
        text: text.trim().slice(0, 1000),
        authorEmail: actorEmail,
        authorName: actorName,
        createdAt: new Date().toISOString(),
      })
    },
    [actorEmail, actorName],
  )

  const deleteComment = useCallback(async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.comments, id))
  }, [])

  const value = useMemo(
    () => ({
      brokers,
      entries,
      comments,
      loading,
      error,
      addEntry,
      updateEntry,
      setEntryStatus,
      deleteEntry,
      addComment,
      deleteComment,
    }),
    [
      brokers,
      entries,
      comments,
      loading,
      error,
      addEntry,
      updateEntry,
      setEntryStatus,
      deleteEntry,
      addComment,
      deleteComment,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/**
 * Deja pasar UNICAMENTE los campos del modelo.
 *
 * Es el ultimo filtro del lado del navegador contra escribir algo que no
 * corresponde (las reglas del servidor rechazan lo mismo). Si alguien agrega
 * un campo de cliente a un formulario, aqui se cae antes de salir del equipo.
 */
function sanitize(draft: EntryDraft): EntryDraft {
  return {
    brokerId: draft.brokerId,
    date: draft.date,
    kind: draft.kind,
    points: Number(draft.points) || 0,
    quoteSent: Boolean(draft.quoteSent),
    brokerFee: Number(draft.brokerFee) || 0,
    feeCollected: Boolean(draft.feeCollected),
    status: draft.status,
    note: (draft.note ?? '').slice(0, 280),
  }
}

/** Rellena defaults por si un documento viejo trae campos faltantes. */
function normalizeEntry(id: string, data: Record<string, unknown>): Entry {
  return {
    id,
    brokerId: String(data.brokerId ?? ''),
    date: String(data.date ?? ''),
    kind: (data.kind ?? 'opportunity') as Entry['kind'],
    points: Number(data.points ?? 0),
    quoteSent: Boolean(data.quoteSent),
    brokerFee: Number(data.brokerFee ?? 0),
    feeCollected: Boolean(data.feeCollected),
    status: (data.status ?? 'pending') as EntryStatus,
    note: String(data.note ?? ''),
    createdBy: String(data.createdBy ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  }
}

export function useData() {
  return useContext(DataContext)
}
