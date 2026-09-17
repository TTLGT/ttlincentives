import { LogIn, Lock, TriangleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { COMPANY_NAME, COMPETITION_NAME } from '../config/competition'
import { firebaseConfigured } from '../lib/firebase'

/**
 * Lo unico que ve alguien sin sesion aprobada.
 *
 * Aqui no se pinta ni un nombre, ni una foto, ni un numero del tablero.
 * El sitio es publico; los datos no.
 */
export function SignIn() {
  const { status, user, error, signIn, signOutNow } = useAuth()
  const rejected = status === 'not-approved'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-navy-300 uppercase">
            {COMPANY_NAME}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{COMPETITION_NAME}</h1>
          <p className="mt-3 text-sm text-navy-200">
            Tablero de posiciones. Acceso solo para cuentas autorizadas.
          </p>
        </div>

        <div className="rounded-xl border border-navy-700 bg-navy-800 p-6 shadow-xl">
          {!firebaseConfigured && (
            <Notice tone="warning">
              Falta configurar el proyecto de Firebase en <code>src/lib/firebase.ts</code>. El
              inicio de sesion no va a funcionar hasta que se peguen los valores reales.
            </Notice>
          )}

          {rejected ? (
            <>
              <div className="mb-4 flex justify-center">
                <span className="rounded-full bg-navy-900 p-3">
                  <Lock className="h-7 w-7 text-navy-300" aria-hidden="true" />
                </span>
              </div>
              <h2 className="text-center text-lg font-bold text-white">Cuenta sin acceso</h2>
              <p className="mt-2 text-center text-sm text-navy-200">
                La cuenta{' '}
                <span className="font-semibold text-white">{user?.email}</span> no esta en la lista
                de acceso. Pedile a Nery u Erwin que te agreguen.
              </p>
              <button type="button" onClick={signOutNow} className="btn-ghost mt-6 w-full border-navy-600 text-navy-100 hover:bg-navy-700">
                Cerrar sesion y probar con otra cuenta
              </button>
            </>
          ) : (
            <>
              <div className="mb-4 flex justify-center">
                <span className="rounded-full bg-navy-900 p-3">
                  <Lock className="h-7 w-7 text-navy-300" aria-hidden="true" />
                </span>
              </div>
              <h2 className="text-center text-lg font-bold text-white">Inicia sesion</h2>
              <p className="mt-2 text-center text-sm text-navy-200">
                Usa tu cuenta de correo de Total Transport Logistics.
              </p>
              <button
                type="button"
                onClick={signIn}
                disabled={status === 'loading'}
                className="btn mt-6 w-full bg-white py-3 text-base text-navy-900 hover:bg-navy-100"
              >
                <LogIn className="h-5 w-5" aria-hidden="true" />
                Entrar con Google
              </button>
            </>
          )}

          {error && <Notice tone="error">{error}</Notice>}
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">
          Este tablero no guarda ni muestra informacion de clientes.
        </p>
      </div>
    </main>
  )
}

function Notice({ tone, children }: { tone: 'warning' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-4 flex gap-2 rounded-lg p-3 text-sm ${
        tone === 'error'
          ? 'bg-red-950 text-red-200'
          : 'bg-amber-950 text-amber-200'
      }`}
      role="status"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
