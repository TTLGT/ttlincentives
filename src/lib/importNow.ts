/**
 * Dispara la importacion de la hoja desde el panel de administracion.
 *
 * El navegador NUNCA toca el Google Sheet: la hoja tiene datos de cliente y es
 * privada. Esto solo le pide a una Cloud Function que corra la importacion del
 * lado del servidor, con la service account. Lo que vuelve es un resumen con
 * puras cuentas.
 */

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions'
import { functions } from './firebase'

/** Lo que devuelve la funcion. Sin datos de cliente, solo cuentas. */
export interface ImportSummary {
  ok: true
  dryRun: boolean
  tab: string
  tzWarning: string | null
  empty?: boolean
  rowsRead: number
  usable: number
  created: number
  updated: number
  unchanged: number
  written: number
  skipped: {
    blank: number
    unknownEmail: string[]
    outOfRange: string[]
    badDate: number
  }
}

const call = httpsCallable<{ dryRun?: boolean }, ImportSummary>(functions, 'runImportNow')

export async function runImportNow(dryRun = false): Promise<ImportSummary> {
  try {
    const res: HttpsCallableResult<ImportSummary> = await call({ dryRun })
    return res.data
  } catch (err) {
    throw new Error(translate(err))
  }
}

/**
 * Los errores de una funcion callable llegan casi mudos al navegador. El caso
 * mas comun al principio es que la funcion todavia no este desplegada: el
 * navegador lo reporta como un problema de CORS, porque un 404 no trae las
 * cabeceras, y en pantalla se ve un "internal" que no le dice nada a nadie.
 */
function translate(err: unknown): string {
  const e = err as { code?: string; message?: string }
  const code = String(e?.code ?? '')
  const message = String(e?.message ?? '')

  if (code === 'functions/unauthenticated') return 'Tu sesion expiro. Vuelve a entrar.'
  if (code === 'functions/permission-denied') {
    return message || 'Solo las cuentas de administracion pueden actualizar.'
  }
  // 'internal' a secas, sin nada que agregar, es la funcion que no responde.
  if (code === 'functions/internal' && (!message || message === 'internal')) {
    return (
      'No se pudo contactar la funcion runImportNow. Puede que todavia no este ' +
      'desplegada: corre "firebase deploy --only functions". Mientras tanto la ' +
      'importacion automatica cada 10 minutos sigue funcionando.'
    )
  }
  return message || 'No se pudo importar.'
}

/** Una frase corta para mostrarle al admin lo que acaba de pasar. */
export function describeImport(s: ImportSummary): string {
  if (s.empty) return `La pestania "${s.tab}" esta vacia. No hay nada que importar.`

  const parts: string[] = []
  if (s.created > 0) parts.push(`${s.created} nueva${s.created === 1 ? '' : 's'}`)
  if (s.updated > 0) parts.push(`${s.updated} actualizada${s.updated === 1 ? '' : 's'}`)

  const head =
    parts.length > 0
      ? (s.dryRun ? 'Se importarian ' : 'Listo: ') + parts.join(' y ')
      : 'El tablero ya estaba al dia'

  const tail: string[] = []
  const unknown = s.skipped.unknownEmail.length
  if (unknown > 0) tail.push(`${unknown} correo(s) sin broker`)
  if (s.skipped.outOfRange.length > 0) tail.push(`${s.skipped.outOfRange.length} fuera de fecha`)
  if (s.skipped.badDate > 0) tail.push(`${s.skipped.badDate} con fecha ilegible`)

  return tail.length > 0 ? `${head}. Se saltaron: ${tail.join(', ')}.` : `${head}.`
}
