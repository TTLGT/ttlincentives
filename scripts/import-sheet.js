#!/usr/bin/env node
/**
 * Importa las respuestas del Google Form al tablero.
 *
 *   node scripts/import-sheet.js --dry-run    muestra el plan, no escribe nada
 *   node scripts/import-sheet.js              importa de verdad
 *
 * =========================================================================
 * REGLA DURA DE PRIVACIDAD
 * =========================================================================
 * La hoja tiene columnas con datos de cliente: nombre, telefono, direccion de
 * recoleccion, direccion de entrega, dimensiones y el link a la captura de la
 * cotizacion.
 *
 * NINGUNA de esas columnas se guarda. Este script arma cada entrada leyendo
 * SOLO las columnas de la lista SAFE_COLUMNS de abajo y descarta el resto en
 * el momento. Tampoco las imprime en pantalla ni en los logs.
 *
 * La unica excepcion es "Quote's Proof", y de ella no se guarda el link sino
 * un booleano: si hay algo en esa celda, la cotizacion se envio. Eso alimenta
 * el primer desempate de la Fase 1. El link jamas sale de la hoja.
 *
 * Si algun dia se agrega una columna nueva al formulario, este script la ignora
 * salvo que se agregue a SAFE_COLUMNS a proposito.
 * =========================================================================
 *
 * Credenciales: la misma service account del seed.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\a\clave.json"
 *
 * Ademas hay que COMPARTIR la hoja con el correo de la service account (como
 * lector) y tener habilitada la API de Google Sheets en el proyecto.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** La hoja de respuestas del formulario. */
const SHEET_ID =
  process.env.SHEET_ID || '1BeUm5ANDv2mRBKTK1NRGshcc7M_tFgzSgqCMcf9P33Y'

/** Pestania a leer. */
const TAB = process.env.SHEET_TAB || 'Responses 2026'

/**
 * Las UNICAS columnas que este script llega a usar, por nombre de encabezado.
 * Se buscan por nombre y no por posicion, asi que mover una columna en la hoja
 * no rompe la importacion.
 */
const SAFE_COLUMNS = {
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
 *
 * Si prefieren que cuente como cobrado apenas se importa, poner true.
 */
const IMPORTED_FEE_IS_COLLECTED = false

const COMPETITION_START = '2026-09-16'
const COMPETITION_END = '2026-09-30'
const GUATEMALA_TZ = 'America/Guatemala'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run') || args.has('-n')

if (args.has('--help') || args.has('-h')) {
  console.log(
    [
      'Uso: node scripts/import-sheet.js [--dry-run]',
      '',
      '  --dry-run, -n   Muestra lo que haria y no escribe nada.',
      '',
      'Variables:',
      '  GOOGLE_APPLICATION_CREDENTIALS  service account (obligatoria)',
      '  SHEET_ID                        id de la hoja (tiene valor por defecto)',
      '  SHEET_TAB                       pestania (por defecto "Responses 2026")',
      '',
      'La hoja debe estar compartida con el correo de la service account.',
    ].join('\n'),
  )
  process.exit(0)
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
function toDate(timestamp) {
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
  // ejemplo), y en esas la fecha sale idéntica. Solo se avisa si de verdad
  // difiere en algun dia de la competencia.
  if (tz && tz !== GUATEMALA_TZ && !sameOffsetAsGuatemala(tz)) {
    console.warn(
      `\nAVISO: la hoja esta en zona horaria "${tz}", que no coincide con ${GUATEMALA_TZ}.\n` +
        'Las respuestas cerca de la medianoche pueden caer en el dia equivocado.\n' +
        'Se arregla en Google Sheets: Archivo > Configuracion > Zona horaria.\n',
    )
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${TAB}'`,
    valueRenderOption: 'FORMATTED_VALUE',
  })

  const values = res.data.values ?? []
  if (values.length === 0) return { header: [], rows: [] }

  const header = values[0].map((h) => String(h).trim())
  return { header, rows: values.slice(1) }
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

// ---------------------------------------------------------------------------
// Escribir
// ---------------------------------------------------------------------------

async function connectFirestore() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '\nFalta GOOGLE_APPLICATION_CREDENTIALS.\n' +
        'Apuntalo al JSON de la service account y volve a correr.\n',
    )
    process.exit(1)
  }
  const admin = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  if (admin.getApps().length === 0) {
    admin.initializeApp({ credential: admin.applicationDefault() })
  }
  return getFirestore()
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

async function main() {
  const db = await connectFirestore()
  const brokerByEmail = await loadBrokerEmails(db)
  if (brokerByEmail.size === 0) {
    console.error('\nNo hay brokers en Firestore. Corre primero: npm run seed\n')
    process.exit(1)
  }

  const { header, rows } = await fetchRows()
  if (header.length === 0) {
    console.log(`\nLa pestania "${TAB}" esta vacia. Nada que importar.\n`)
    return
  }

  const { safe, missing, hasApprovedColumn } = extractSafeRows(header, rows)
  if (missing.length > 0) {
    console.error(
      `\nA la hoja le faltan columnas que este script necesita: ${missing.join(', ')}\n` +
        'Revisa que los encabezados esten escritos igual en la fila 1.\n',
    )
    process.exit(1)
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
  const toUpdate = entries.filter((e) => {
    const prev = existing.get(e.id)
    if (!prev) return false
    return (
      (hasApprovedColumn && prev.status !== e.status) ||
      Number(prev.brokerFee ?? 0) !== e.brokerFee ||
      Boolean(prev.quoteSent) !== e.quoteSent ||
      (prev.source ?? null) !== e.source
    )
  })

  // -- Reporte. Solo broker, fecha, fuente, monto y estado. Nada de cliente. --
  console.log(`\nHoja: ${TAB}`)
  console.log(`Filas leidas: ${rows.length}`)
  console.log(`Filas utilizables: ${entries.length}`)
  console.log(`  nuevas:        ${toCreate.length}`)
  console.log(`  con cambios:   ${toUpdate.length}`)
  console.log(`  sin cambios:   ${entries.length - toCreate.length - toUpdate.length}`)

  if (!hasApprovedColumn) {
    console.log(
      [
        '',
        'NOTA: la hoja no tiene columna "Approved".',
        'Todo entra como PENDIENTE y se aprueba desde el panel del sitio.',
        'Reimportar no revierte lo que ya hayas validado ahi.',
      ].join('\n'),
    )
  }

  const approved = entries.filter((e) => e.status === 'approved').length
  console.log(`\nAprobadas (casilla marcada): ${approved}`)
  console.log(`Pendientes de aprobar:       ${entries.length - approved}`)

  if (toCreate.length > 0) {
    console.log('\nNuevas:')
    for (const e of toCreate.slice(0, 40)) {
      const fee = e.brokerFee > 0 ? `$${e.brokerFee}` : '-'
      console.log(
        `  ${e.date}  ${e.brokerId.padEnd(18)} ${String(e.source ?? '-').padEnd(16)} ${fee.padEnd(9)} ${e.status}`,
      )
    }
    if (toCreate.length > 40) console.log(`  ... y ${toCreate.length - 40} mas`)
  }

  if (skipped.unknownEmail.length > 0) {
    const unique = [...new Set(skipped.unknownEmail)]
    console.log(`\nOJO: ${skipped.unknownEmail.length} fila(s) con un correo que no es de ningun broker:`)
    for (const email of unique.slice(0, 10)) console.log(`  ${email}`)
    console.log('Si alguno deberia competir, agregalo a data/members.json y corre npm run seed.')
  }
  if (skipped.outOfRange.length > 0) {
    console.log(
      `\n${skipped.outOfRange.length} fila(s) fuera del rango de la competencia ` +
        `(${COMPETITION_START} a ${COMPETITION_END}). No se importan.`,
    )
  }
  if (skipped.badDate > 0) console.log(`\n${skipped.badDate} fila(s) con fecha ilegible.`)

  if (DRY_RUN) {
    console.log('\n--dry-run: no se escribio nada en Firestore.\n')
    return
  }

  if (toCreate.length === 0 && toUpdate.length === 0) {
    console.log('\nNada que escribir: el tablero ya esta al dia.\n')
    return
  }

  const now = new Date().toISOString()
  const actor = 'import@sheet'
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
      } else if (toUpdate.some((u) => u.id === e.id)) {
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

  console.log(`\nListo: ${toCreate.length} creadas, ${toUpdate.length} actualizadas (${written} escrituras).\n`)
}

/** Traduce los tropiezos tipicos a algo accionable, sin volcar el stack. */
function explain(err) {
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

try {
  await main()
} catch (err) {
  console.error('\n' + explain(err) + '\n')
  process.exit(1)
}
