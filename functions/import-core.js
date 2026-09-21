/**
 * El motor de la importacion, en un solo lugar.
 *
 * Lo usan dos llamadores y NO hay una segunda copia de esta logica:
 *   - scripts/import-sheet.js   la linea de comandos y GitHub Actions
 *   - functions/index.js        el boton "Actualizar ahora" del panel
 *
 * =========================================================================
 * REGLA DURA DE PRIVACIDAD
 * =========================================================================
 * La hoja tiene columnas con datos de cliente: nombre, telefono, direccion de
 * recoleccion, direccion de entrega, dimensiones y el link a la captura de la
 * cotizacion.
 *
 * NINGUNA de esas columnas se guarda. Este modulo arma cada entrada leyendo
 * SOLO las columnas de SAFE_COLUMNS y descarta el resto en el momento. Tampoco
 * las devuelve en el resumen ni las escribe en un log.
 *
 * La unica excepcion es "Quote's Proof", y de ella no se guarda el link sino
 * un booleano: si hay algo en esa celda, la cotizacion se envio. El link jamas
 * sale de la hoja.
 *
 * Si algun dia se agrega una columna nueva al formulario, se ignora salvo que
 * se agregue a SAFE_COLUMNS a proposito.
 * =========================================================================
 */

import { createHash } from 'node:crypto'

/** La hoja de respuestas del formulario. */
export const SHEET_ID =
  process.env.SHEET_ID || '1BeUm5ANDv2mRBKTK1NRGshcc7M_tFgzSgqCMcf9P33Y'

/** Pestania a leer. */
export const TAB = process.env.SHEET_TAB || 'Responses 2026'

/**
 * Las UNICAS columnas que este modulo llega a usar, por nombre de encabezado.
 * Se buscan por nombre y no por posicion, asi que mover una columna en la hoja
 * no rompe la importacion.
 */
export const SAFE_COLUMNS = {
  timestamp: 'Timestamp',
  email: 'Email Address',
  source: "Load's Source",
  fee: 'Broker Fee',
  approved: 'Approved',
  /** De esta SOLO se mira si esta vacia o no. El valor no se guarda nunca. */
  quoteProofPresence: "Quote's Proof",
}

/** Lista cerrada de fuentes. Debe coincidir con ENTRY_SOURCES y firestore.rules. */
const SOURCES = [
  'Repeat',
  'Cold Calling',
  'Referral',
  'Veritread',
  'Reactivated',
  'Cold Emailing',
  'Central Dispatch',
  'Facebook',
  'Other',
]

/**
 * Si el fee que viene de la hoja se considera COBRADO.
 *
 * Por defecto NO: que el broker anote el monto de la cotizacion no significa
 * que el dinero ya entro, y el piso de $2,000 para calificar habla de fee
 * cobrado. Asi que se importa como pendiente y un admin lo marca como cobrado
 * en el panel cuando se confirma.
 */
const IMPORTED_FEE_IS_COLLECTED = false

const COMPETITION_START = '2026-09-16'
const COMPETITION_END = '2026-09-30'
const GUATEMALA_TZ = 'America/Guatemala'

/** Un tropiezo que ya sabemos explicar. `hint` es texto para un humano. */
export class ImportError extends Error {
  constructor(hint, cause) {
    super(hint)
    this.name = 'ImportError'
    this.hint = hint
    this.cause = cause
  }
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Si una zona horaria tiene el mismo desfase que Guatemala en toda la ventana
 * de la competencia. America/Belize, por ejemplo, es UTC-6 sin horario de
 * verano igual que Guatemala, asi que las fechas salen identicas y no hay
 * nada que avisar.
 */
function sameOffsetAsGuatemala(tz) {
  const probes = [`${COMPETITION_START}T05:00:00Z`, `${COMPETITION_END}T23:00:00Z`]
  try {
    return probes.every((iso) => offsetMinutes(tz, new Date(iso)) === offsetMinutes(GUATEMALA_TZ, new Date(iso)))
  } catch {
    return false
  }
}

/** Minutos de desfase de una zona horaria en un instante dado. */
function offsetMinutes(tz, instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/** Id estable de una fila: mismo timestamp y mismo correo -> misma entrada. */
function rowId(timestamp, email) {
  return 'sheet_' + createHash('sha1').update(`${timestamp}|${email.toLowerCase()}`).digest('hex').slice(0, 24)
}

/** '9/18/2026 14:03:11' -> '2026-09-18'. Toma la fecha tal como la muestra la hoja. */
export function toDate(timestamp) {
  const text = String(timestamp).trim()
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    const [, m, d, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  return null
}

/** '$1,250.00' -> 1250. Cualquier cosa rara -> 0. */
function toMoney(raw) {
  if (raw === undefined || raw === null || raw === '') return 0
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

/** La casilla Approved: TRUE / VERDADERO / SI / x cuentan como marcada. */
function isChecked(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  return v === 'true' || v === 'verdadero' || v === 'si' || v === 'sí' || v === 'yes' || v === 'x' || v === '1'
}

/** Solo valores de la lista. El texto libre de "Other:" se reduce a 'Other'. */
function normalizeSource(raw) {
  const clean = String(raw ?? '').trim()
  if (!clean) return null
  const match = SOURCES.find((s) => s.toLowerCase() === clean.toLowerCase())
  return match ?? 'Other'
}

// ---------------------------------------------------------------------------
// Leer la hoja
// ---------------------------------------------------------------------------

async function fetchRows() {
  const { google } = await import('googleapis')
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  // Avisar si la hoja no esta en hora de Guatemala: el corte de las 3:00 PM y
  // la fecha de cada entrada dependen de eso.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'properties.timeZone' })
  const tz = meta.data.properties?.timeZone

  // Lo que importa no es el nombre de la zona sino el desfase real: hay varias
  // que son UTC-6 sin horario de verano igual que Guatemala (Belize, por
  // ejemplo), y en esas la fecha sale identica. Solo se avisa si de verdad
  // difiere en algun dia de la competencia.
  const tzWarning =
    tz && tz !== GUATEMALA_TZ && !sameOffsetAsGuatemala(tz)
      ? `La hoja esta en zona horaria "${tz}", que no coincide con ${GUATEMALA_TZ}. ` +
        'Las respuestas cerca de la medianoche pueden caer en el dia equivocado. ' +
        'Se arregla en Google Sheets: Archivo > Configuracion > Zona horaria.'
      : null

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${TAB}'`,
    valueRenderOption: 'FORMATTED_VALUE',
  })

  const values = res.data.values ?? []
  if (values.length === 0) return { header: [], rows: [], tzWarning }

  const header = values[0].map((h) => String(h).trim())
  return { header, rows: values.slice(1), tzWarning }
}

/**
 * Se queda UNICAMENTE con las columnas seguras.
 *
 * Aqui es donde se cortan los datos de cliente: lo que no esta en SAFE_COLUMNS
 * no pasa de esta funcion.
 */
function extractSafeRows(header, rows) {
  const at = {}
  for (const [key, name] of Object.entries(SAFE_COLUMNS)) {
    const idx = header.findIndex((h) => h.toLowerCase() === name.toLowerCase())
    at[key] = idx
  }

  // 'approved' y 'fee' son opcionales: un cambio en el formulario de Google
  // reescribe las columnas de respuestas y se puede llevar por delante una
  // columna agregada a mano. Sin ellas la importacion sigue corriendo.
  const OPTIONAL = new Set(['approved', 'fee', 'quoteProofPresence'])
  const missing = Object.entries(SAFE_COLUMNS)
    .filter(([key]) => at[key] === -1 && !OPTIONAL.has(key))
    .map(([, name]) => name)

  const safe = rows.map((row) => ({
    timestamp: at.timestamp >= 0 ? row[at.timestamp] ?? '' : '',
    email: at.email >= 0 ? String(row[at.email] ?? '').trim().toLowerCase() : '',
    source: at.source >= 0 ? row[at.source] ?? '' : '',
    fee: at.fee >= 0 ? row[at.fee] ?? '' : '',
    approved: at.approved >= 0 ? row[at.approved] ?? '' : '',
    // Solo presencia. El link no se copia a ninguna variable que se guarde.
    hasQuoteProof:
      at.quoteProofPresence >= 0 ? String(row[at.quoteProofPresence] ?? '').trim().length > 0 : false,
  }))

  return { safe, missing, hasApprovedColumn: at.approved !== -1 }
}

// ---------------------------------------------------------------------------
// Armar las entradas
// ---------------------------------------------------------------------------

function buildEntries(safeRows, brokerByEmail, hasApprovedColumn) {
  const entries = []
  const skipped = { blank: 0, unknownEmail: [], outOfRange: [], badDate: 0 }

  for (const row of safeRows) {
    if (!row.timestamp && !row.email) {
      skipped.blank++
      continue
    }
    if (!row.email) {
      skipped.blank++
      continue
    }

    const brokerId = brokerByEmail.get(row.email)
    if (!brokerId) {
      skipped.unknownEmail.push(row.email)
      continue
    }

    const date = toDate(row.timestamp)
    if (!date) {
      skipped.badDate++
      continue
    }
    if (date < COMPETITION_START || date > COMPETITION_END) {
      skipped.outOfRange.push(date)
      continue
    }

    entries.push({
      id: rowId(row.timestamp, row.email),
      brokerId,
      date,
      // Cada respuesta del formulario es una oportunidad nueva: +1.
      // Los bonos (cold call, referido, primer cierre) los agrega un admin,
      // porque requieren criterio y la hoja no los distingue de forma confiable.
      kind: 'opportunity',
      points: 1,
      quoteSent: row.hasQuoteProof,
      brokerFee: toMoney(row.fee),
      feeCollected: IMPORTED_FEE_IS_COLLECTED && toMoney(row.fee) > 0,
      // Sin columna Approved, todo entra como pendiente y se valida en el
      // panel del sitio, que ya tiene su cola de aprobacion.
      status: hasApprovedColumn && isChecked(row.approved) ? 'approved' : 'pending',
      note: '',
      source: normalizeSource(row.source),
      sourceId: rowId(row.timestamp, row.email),
    })
  }

  return { entries, skipped }
}

/** correo -> brokerId, leido de members/ (que es la lista blanca real). */
async function loadBrokerEmails(db) {
  const snap = await db.collection('members').get()
  const map = new Map()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.brokerId) map.set(doc.id.toLowerCase(), data.brokerId)
  }
  return map
}

// ---------------------------------------------------------------------------
// Importar
// ---------------------------------------------------------------------------

/**
 * Corre la importacion completa y devuelve un resumen.
 *
 * El resumen NO lleva datos de cliente: solo cuentas, y la lista de correos
 * que no son de ningun broker (que son del equipo, no de clientes).
 *
 * @param {object}  db              Firestore admin ya inicializado.
 * @param {boolean} dryRun          true = no escribe nada.
 * @param {string}  actor           Quien queda como autor de las escrituras.
 * @returns {Promise<object>} resumen
 */
export async function runImport({ db, dryRun = false, actor = 'import@sheet' }) {
  const brokerByEmail = await loadBrokerEmails(db)
  if (brokerByEmail.size === 0) {
    throw new ImportError('No hay brokers en Firestore. Corre primero: npm run seed')
  }

  const { header, rows, tzWarning } = await fetchRows()
  if (header.length === 0) {
    return {
      dryRun, tab: TAB, tzWarning,
      rowsRead: 0, usable: 0, created: 0, updated: 0, unchanged: 0, written: 0,
      skipped: { blank: 0, unknownEmail: [], outOfRange: [], badDate: 0 },
      empty: true,
    }
  }

  const { safe, missing, hasApprovedColumn } = extractSafeRows(header, rows)
  if (missing.length > 0) {
    throw new ImportError(
      `A la hoja le faltan columnas que la importacion necesita: ${missing.join(', ')}. ` +
        'Revisa que los encabezados esten escritos igual en la fila 1.',
    )
  }

  const { entries, skipped } = buildEntries(safe, brokerByEmail, hasApprovedColumn)

  // Que hay ya en Firestore para estas filas
  const existing = new Map()
  for (let i = 0; i < entries.length; i += 30) {
    const slice = entries.slice(i, i + 30)
    const docs = await db.getAll(...slice.map((e) => db.collection('entries').doc(e.id)))
    for (const doc of docs) if (doc.exists) existing.set(doc.id, doc.data())
  }

  const toCreate = entries.filter((e) => !existing.has(e.id))
  const toUpdateIds = new Set(
    entries
      .filter((e) => {
        const prev = existing.get(e.id)
        if (!prev) return false
        return (
          (hasApprovedColumn && prev.status !== e.status) ||
          Number(prev.brokerFee ?? 0) !== e.brokerFee ||
          Boolean(prev.quoteSent) !== e.quoteSent ||
          (prev.source ?? null) !== e.source
        )
      })
      .map((e) => e.id),
  )

  const summary = {
    dryRun, tab: TAB, tzWarning, hasApprovedColumn,
    rowsRead: rows.length,
    usable: entries.length,
    created: toCreate.length,
    updated: toUpdateIds.size,
    unchanged: entries.length - toCreate.length - toUpdateIds.size,
    written: 0,
    // unknownEmail se deduplica: la misma direccion puede repetirse en muchas filas.
    skipped: { ...skipped, unknownEmail: [...new Set(skipped.unknownEmail)] },
  }

  if (dryRun || (toCreate.length === 0 && toUpdateIds.size === 0)) return summary

  const now = new Date().toISOString()
  let written = 0
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch()
    let batchCount = 0
    for (const e of entries.slice(i, i + 400)) {
      const ref = db.collection('entries').doc(e.id)
      const prev = existing.get(e.id)
      if (!prev) {
        const { id, ...doc } = e
        void id
        batch.set(ref, { ...doc, createdBy: actor, createdAt: now, updatedBy: actor, updatedAt: now })
        batchCount++
      } else if (toUpdateIds.has(e.id)) {
        // Solo lo que manda la hoja. Los puntos y la nota se dejan como esten,
        // para no pisar lo que un admin haya ajustado a mano.
        batch.update(ref, {
          // El estado solo se toca si la hoja lo manda. Si la aprobacion vive
          // en el sitio, reimportar nunca revierte lo que ya valido un admin.
          ...(hasApprovedColumn ? { status: e.status } : {}),
          brokerFee: e.brokerFee,
          feeCollected: e.feeCollected,
          quoteSent: e.quoteSent,
          source: e.source,
          updatedBy: actor,
          updatedAt: now,
        })
        batchCount++
      }
    }
    if (batchCount > 0) {
      await batch.commit()
      written += batchCount
    }
  }

  summary.written = written
  return summary
}

/** Traduce los tropiezos tipicos a algo accionable, sin volcar el stack. */
export function explain(err) {
  if (err instanceof ImportError) return err.hint

  const message = String(err?.message ?? err)
  const status = err?.code ?? err?.response?.status

  if (message.includes('Google Sheets API has not been used') || message.includes('SERVICE_DISABLED')) {
    return [
      'La API de Google Sheets no esta habilitada en el proyecto.',
      '',
      'Habilitala aqui y espera un minuto:',
      '  https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=ttl-incentives',
    ].join('\n')
  }
  if (status === 403 || message.includes('does not have permission') || message.includes('PERMISSION_DENIED')) {
    return [
      'La service account no tiene acceso a la hoja.',
      '',
      'Abri la hoja > Compartir > y agregala como LECTOR:',
      '  firebase-adminsdk-fbsvc@ttl-incentives.iam.gserviceaccount.com',
      '',
      'Desmarca "Notificar a las personas" (no es un buzon real).',
    ].join('\n')
  }
  if (status === 404 || message.includes('Requested entity was not found')) {
    return `No se encontro la hoja con id ${SHEET_ID}. Revisa SHEET_ID.`
  }
  if (message.includes('Unable to parse range')) {
    return [
      `No existe una pestania llamada "${TAB}" en la hoja.`,
      'Revisa el nombre exacto de la pestania, o pasa otro con SHEET_TAB.',
    ].join('\n')
  }
  if (message.includes('Could not load the default credentials')) {
    return [
      'No se encontraron credenciales.',
      '',
      'PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\keys\\<archivo>.json"',
    ].join('\n')
  }
  return message
}
