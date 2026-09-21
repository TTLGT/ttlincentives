/**
 * Guardia de la regla dura: NADA de informacion de cliente entra al tablero.
 *
 * Estas pruebas existen para que un cambio futuro no reabra la puerta sin que
 * nadie se de cuenta. Si alguien agrega una columna de cliente al importador o
 * un campo de cliente al modelo, aqui se cae la build antes de llegar a
 * produccion.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ENTRY_SOURCES, normalizeSource } from './scoring'

const root = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

/** Columnas del Google Sheet que NUNCA se pueden guardar. */
const FORBIDDEN_COLUMNS = [
  "Client's Name",
  "Client's Phone Number",
  'Load Origin Address',
  'Load Destination Address',
  "Load's Dimensions",
]

describe('el importador no toca datos de cliente', () => {
  // El motor vive aqui y lo comparten los dos llamadores: la linea de comandos
  // (scripts/import-sheet.js, que usa GitHub Actions) y el boton del panel
  // (functions/index.js). Revisando este archivo se revisan los dos.
  const script = read('functions/import-core.js')

  it('no nombra ninguna columna de cliente como campo a leer', () => {
    // Se permite nombrarlas en los comentarios que explican por que se excluyen,
    // pero nunca dentro del objeto SAFE_COLUMNS.
    const safeBlock = script.slice(
      script.indexOf('const SAFE_COLUMNS'),
      script.indexOf('/** Lista cerrada de fuentes'),
    )
    expect(safeBlock.length).toBeGreaterThan(0)
    for (const column of FORBIDDEN_COLUMNS) {
      expect(safeBlock).not.toContain(column)
    }
  })

  it('del link de la cotizacion solo guarda si existe o no, nunca el valor', () => {
    // La fila segura expone un booleano, no la URL.
    expect(script).toContain('hasQuoteProof')
    // Y lo que se escribe en Firestore es ese booleano en quoteSent.
    expect(script).toContain('quoteSent: row.hasQuoteProof')
  })

  it('no escribe ningun campo fuera del modelo', () => {
    const allowed = [
      // 'id' es la llave del documento, no un campo: el script lo separa con
      // `const { id, ...doc } = e` antes de escribir.
      'id',
      'brokerId', 'date', 'kind', 'points', 'quoteSent', 'brokerFee',
      'feeCollected', 'status', 'note', 'source', 'sourceId',
      'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
    ]
    // Los campos del objeto que se manda a Firestore salen de buildEntries.
    const build = script.slice(script.indexOf('entries.push({'), script.indexOf('return { entries, skipped }'))
    const fields = [...build.matchAll(/^\s{6}([a-zA-Z]+):/gm)].map((m) => m[1])
    expect(fields.length).toBeGreaterThan(5)
    for (const field of fields) {
      expect(allowed).toContain(field)
    }
  })
})

describe('el modelo de datos no tiene campos de cliente', () => {
  it('types.ts no declara nada de cliente', () => {
    const types = read('src/types.ts')
    const declarations = types
      .split('\n')
      .filter((line) => /^\s{2}[a-zA-Z]+\??:/.test(line))
      .join('\n')
      .toLowerCase()

    for (const word of ['client', 'phone', 'address', 'dimension', 'proof', 'screenshot']) {
      expect(declarations).not.toContain(word)
    }
  })

  it('las reglas cierran la lista de campos de una entrada', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('hasOnly(allowedFields())')
    for (const word of ['clientName', "Client's", 'phone', 'originAddress']) {
      expect(rules).not.toContain(word)
    }
  })
})

describe('la fuente es una lista cerrada', () => {
  it('reduce cualquier texto libre a Other', () => {
    // "Other:" en Google Forms deja escribir libremente, y ahi podria
    // terminar el nombre de un cliente. Nunca se guarda ese texto.
    expect(normalizeSource('Other: Juan Perez de Acme Corp')).toBe('Other')
    expect(normalizeSource('cualquier cosa rara')).toBe('Other')
    expect(normalizeSource('')).toBeNull()
    expect(normalizeSource(null)).toBeNull()
  })

  it('reconoce los valores del formulario sin importar mayusculas', () => {
    expect(normalizeSource('cold calling')).toBe('Cold Calling')
    expect(normalizeSource('Central Dispatch')).toBe('Central Dispatch')
    expect(normalizeSource('  Referral  ')).toBe('Referral')
  })

  it('la lista del sitio y la de las reglas coinciden', () => {
    const rules = read('firestore.rules')
    for (const source of ENTRY_SOURCES) {
      expect(rules).toContain(`'${source}'`)
    }
  })

  it('la lista del importador coincide con la del sitio', () => {
    const script = read('functions/import-core.js')
    for (const source of ENTRY_SOURCES) {
      expect(script).toContain(`'${source}'`)
    }
  })
})
