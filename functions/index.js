/**
 * El boton "Actualizar ahora" del panel de administracion.
 *
 * Corre la MISMA importacion que GitHub Actions (functions/import-core.js),
 * pero disparada por un admin desde el sitio. No hay una segunda copia de la
 * logica ni del filtro de privacidad.
 *
 * Por que hace falta una funcion y no se lee la hoja desde el navegador:
 * la hoja tiene datos de cliente y es privada. La llave de la service account
 * no puede vivir en el bundle, que es publico. Asi que la lectura pasa aqui,
 * del lado del servidor, y al navegador solo llega lo ya filtrado.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { runImport, explain } from './import-core.js'

initializeApp()

/**
 * Corre como la misma service account que ya usa GitHub Actions, que es la que
 * esta compartida como LECTOR en la hoja. Asi no hay que volver a compartirla.
 */
setGlobalOptions({
  region: 'us-central1',
  serviceAccount: 'firebase-adminsdk-fbsvc@ttl-incentives.iam.gserviceaccount.com',
})

/**
 * Los correos que pueden tocar el boton.
 * Debe coincidir con ADMIN_EMAILS en src/config/competition.ts y con la
 * funcion isAdmin() de firestore.rules.
 */
const ADMIN_EMAILS = [
  'operations@totaltransportlogistics.us',
  'erwin@totaltransportlogistics.us',
]

export const runImportNow = onCall(
  {
    // La importacion habla con Google Sheets y con Firestore: 120s sobra.
    timeoutSeconds: 120,
    memory: '512MiB',
    // Una sola instancia: dos importaciones a la vez podrian pisarse, igual
    // que el concurrency group del workflow.
    maxInstances: 1,
  },
  async (request) => {
    const auth = request.auth
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Hay que iniciar sesion.')
    }

    const email = String(auth.token.email ?? '').toLowerCase()
    if (!auth.token.email_verified || !ADMIN_EMAILS.includes(email)) {
      throw new HttpsError('permission-denied', 'Solo las cuentas de administracion pueden actualizar.')
    }

    // Segunda revision contra members/, igual que firestore.rules: estar en la
    // lista de arriba no basta si el documento ya no dice 'admin'.
    const db = getFirestore()
    const member = await db.collection('members').doc(email).get()
    if (!member.exists || member.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Tu cuenta ya no tiene rol de administracion.')
    }

    const dryRun = request.data?.dryRun === true

    try {
      const summary = await runImport({ db, dryRun, actor: email })
      // A proposito no se registra nada de la hoja mas alla de las cuentas.
      console.log(
        `import por ${email}: ${summary.created} nuevas, ${summary.updated} actualizadas, ` +
          `${summary.unchanged} sin cambios${dryRun ? ' (prueba)' : ''}`,
      )
      return { ok: true, ...summary }
    } catch (err) {
      console.error('import fallo:', err?.message ?? err)
      throw new HttpsError('internal', explain(err))
    }
  },
)
