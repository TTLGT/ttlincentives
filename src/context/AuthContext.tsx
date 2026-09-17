/**
 * Sesion y permisos del lado del navegador.
 *
 * ESTO SOLO DECIDE QUE SE PINTA EN PANTALLA. La proteccion real de los datos
 * esta en firestore.rules, que vuelve a revisar el correo en el servidor.
 * Nunca confiar solo en lo que hay aqui.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, COLLECTIONS, db, googleProvider } from '../lib/firebase'
import { ADMIN_EMAILS } from '../config/competition'
import type { Member } from '../types'

export type AuthStatus = 'loading' | 'signed-out' | 'not-approved' | 'ready' | 'error'

interface AuthValue {
  status: AuthStatus
  user: User | null
  member: Member | null
  isAdmin: boolean
  error: string | null
  signIn: () => Promise<void>
  signOutNow: () => Promise<void>
}

export const AuthContext = createContext<AuthValue>({
  status: 'loading',
  user: null,
  member: null,
  isAdmin: false,
  error: null,
  signIn: async () => {},
  signOutNow: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setError(null)
      if (!nextUser?.email) {
        setUser(null)
        setMember(null)
        setStatus('signed-out')
        return
      }

      setUser(nextUser)
      const email = nextUser.email.toLowerCase()

      try {
        // Las reglas solo dejan leer el documento propio de members.
        const snapshot = await getDoc(doc(db, COLLECTIONS.members, email))
        if (!snapshot.exists()) {
          setMember(null)
          setStatus('not-approved')
          return
        }
        const data = snapshot.data() as Partial<Member>
        setMember({
          email,
          role: data.role === 'admin' ? 'admin' : 'viewer',
          brokerId: data.brokerId ?? null,
        })
        setStatus('ready')
      } catch (err) {
        // Un correo fuera de la lista blanca recibe permission-denied de las
        // reglas: para el sitio es exactamente lo mismo que no estar aprobado.
        const code = (err as { code?: string })?.code
        if (code === 'permission-denied') {
          setMember(null)
          setStatus('not-approved')
          return
        }
        setMember(null)
        setError(describeError(err))
        setStatus('error')
      }
    })
  }, [])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      setError(describeError(err))
    }
  }, [])

  const signOutNow = useCallback(async () => {
    await signOut(auth)
  }, [])

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase()
    if (!email || status !== 'ready') return false
    // Doble condicion: el rol del documento y la lista escrita en el codigo.
    return member?.role === 'admin' && (ADMIN_EMAILS as readonly string[]).includes(email)
  }, [user, member, status])

  const value = useMemo(
    () => ({ status, user, member, isAdmin, error, signIn, signOutNow }),
    [status, user, member, isAdmin, error, signIn, signOutNow],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function describeError(err: unknown): string {
  const code = (err as { code?: string })?.code
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Este dominio no esta autorizado en Firebase Auth. Agregalo en Authentication > Settings > Authorized domains.'
    case 'auth/configuration-not-found':
      return 'Falta habilitar el proveedor de Google en Firebase Auth.'
    case 'auth/network-request-failed':
      return 'No hay conexion con Firebase. Revisa la red.'
    case 'unavailable':
      return 'Firestore no responde. Reintenta en un momento.'
    default:
      return (err as { message?: string })?.message ?? 'Ocurrio un error inesperado.'
  }
}

export function useAuth() {
  return useContext(AuthContext)
}
