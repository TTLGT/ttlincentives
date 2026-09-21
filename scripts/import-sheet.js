#!/usr/bin/env node
/**
 * Importa las respuestas del Google Form al tablero, desde la linea de
 * comandos y desde GitHub Actions.
 *
 *   node scripts/import-sheet.js --dry-run    muestra el plan, no escribe nada
 *   node scripts/import-sheet.js              importa de verdad
 *
 * Toda la logica (y el filtro de privacidad) vive en functions/import-core.js,
 * que es el mismo modulo que usa el boton "Actualizar ahora" del panel. Este
 * archivo solo es la linea de comandos: argumentos, reporte y codigos de salida.
 *
 * Credenciales: la misma service account del seed.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\a\clave.json"
 *
 * Ademas hay que COMPARTIR la hoja con el correo de la service account (como
 * lector) y tener habilitada la API de Google Sheets en el proyecto.
 */

import { runImport, explain, TAB } from '../functions/import-core.js'

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

async function connectFirestore() {
  const admin = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  if (admin.getApps().length === 0) {
    admin.initializeApp({ credential: admin.applicationDefault() })
  }
  return getFirestore()
}

try {
  const db = await connectFirestore()
  const summary = await runImport({ db, dryRun: DRY_RUN })

  if (summary.tzWarning) console.warn('\nAVISO: ' + summary.tzWarning + '\n')

  if (summary.empty) {
    console.log(`\nLa pestania "${TAB}" esta vacia. Nada que importar.\n`)
    process.exit(0)
  }

  // -- Reporte. Solo broker, fecha, fuente, monto y estado. Nada de cliente. --
  console.log(`\nHoja: ${summary.tab}`)
  console.log(`Filas leidas: ${summary.rowsRead}`)
  console.log(`Filas utilizables: ${summary.usable}`)
  console.log(`  nuevas:        ${summary.created}`)
  console.log(`  con cambios:   ${summary.updated}`)
  console.log(`  sin cambios:   ${summary.unchanged}`)

  const { blank, unknownEmail, outOfRange, badDate } = summary.skipped
  if (unknownEmail.length > 0) {
    console.log(`\nOJO: ${unknownEmail.length} correo(s) que no son de ningun broker:`)
    for (const e of unknownEmail) console.log(`  ${e}`)
  }
  if (outOfRange.length > 0) {
    console.log(`\n${outOfRange.length} fila(s) fuera del rango de la competencia (Sept 16-30).`)
  }
  if (badDate > 0) console.log(`\n${badDate} fila(s) con fecha ilegible.`)
  if (blank > 0) console.log(`${blank} fila(s) en blanco.`)

  if (summary.dryRun) {
    console.log('\n--dry-run: no se escribio nada en Firestore.\n')
  } else if (summary.written === 0) {
    console.log('\nNada que escribir: el tablero ya esta al dia.\n')
  } else {
    console.log(
      `\nListo: ${summary.created} creadas, ${summary.updated} actualizadas ` +
        `(${summary.written} escrituras).\n`,
    )
  }
} catch (err) {
  console.error('\n' + explain(err) + '\n')
  process.exit(1)
}
