#!/usr/bin/env node
/**
 * Carga la lista blanca (members) y el roster de brokers a Firestore
 * desde data/members.json.
 *
 *   node scripts/seed-members.js --dry-run     imprime lo que haria, no escribe
 *   node scripts/seed-members.js               escribe de verdad
 *   node scripts/seed-members.js --prune       ademas borra lo que ya no este en el JSON
 *
 * Credenciales: se usa una service account que NO vive en el repositorio.
 *   Windows PowerShell:  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\a\clave.json"
 *   bash:                export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/clave.json
 *
 * La coleccion `members` no se puede escribir desde el navegador: se siembra
 * solo con este script. Ver firestore.rules.
 *
 * REGLA DURA: este script no escribe ningun dato de cliente. Solo correos,
 * nombres de brokers y roles.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = resolve(HERE, '..', 'data', 'members.json')

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run') || args.has('-n')
const PRUNE = args.has('--prune')

if (args.has('--help') || args.has('-h')) {
  console.log(
    [
      'Uso: node scripts/seed-members.js [--dry-run] [--prune]',
      '',
      '  --dry-run, -n   Imprime el plan completo y no escribe nada.',
      '  --prune         Borra de Firestore los members/brokers que ya no estan en data/members.json.',
      '',
      'Requiere GOOGLE_APPLICATION_CREDENTIALS apuntando a una service account del proyecto.',
    ].join('\n'),
  )
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Construir el plan a partir del JSON
// ---------------------------------------------------------------------------

/** @typedef {{ email: string, role: 'admin'|'viewer', brokerId: string|null }} MemberDoc */

function buildPlan() {
  const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const domain = raw.domain
  const joinedAt = raw.joinedAt

  const email = (local) => `${local}@${domain}`.toLowerCase()

  /** @type {Map<string, MemberDoc>} */
  const members = new Map()
  const brokers = []

  for (const admin of raw.admins) {
    members.set(email(admin.local), { email: email(admin.local), role: 'admin', brokerId: null })
  }

  for (const staff of raw.staffViewers) {
    const key = email(staff.local)
    if (members.has(key)) continue
    members.set(key, { email: key, role: 'viewer', brokerId: null })
  }

  for (const broker of raw.brokers) {
    const key = email(broker.local)
    brokers.push({
      id: broker.id,
      name: broker.name,
      email: key,
      photoPath: `photos/${broker.id}.jpg`,
      active: true,
      joinedAt,
    })
    const existing = members.get(key)
    if (existing) {
      // Un admin que ademas compite conserva su rol de admin.
      existing.brokerId = broker.id
    } else {
      members.set(key, { email: key, role: 'viewer', brokerId: broker.id })
    }
  }

  return { members: [...members.values()], brokers }
}

function printPlan({ members, brokers }) {
  console.log('\nOrigen: data/members.json')
  console.log(`\nmembers/  ->  ${members.length} documentos`)
  for (const m of members) {
    const tag = m.role === 'admin' ? 'admin ' : 'viewer'
    console.log(`  ${tag}  ${m.email.padEnd(45)} brokerId=${m.brokerId ?? 'null'}`)
  }
  console.log(`\nbrokers/  ->  ${brokers.length} documentos`)
  for (const b of brokers) {
    console.log(`  ${b.id.padEnd(20)} ${b.name.padEnd(20)} ${b.photoPath}`)
  }

  const admins = members.filter((m) => m.role === 'admin').length
  console.log(
    `\nResumen: ${admins} admin(s), ${members.length - admins} viewer(s), ${brokers.length} brokers.`,
  )
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

async function write(plan) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '\nFalta GOOGLE_APPLICATION_CREDENTIALS.\n' +
        'Apuntalo a la service account del proyecto y volve a correr.\n' +
        'Para ver el plan sin escribir:  node scripts/seed-members.js --dry-run\n',
    )
    process.exit(1)
  }

  let admin
  try {
    admin = await import('firebase-admin/app')
  } catch {
    console.error('\nFalta firebase-admin. Instalalo con:  npm install -D firebase-admin\n')
    process.exit(1)
  }
  const { getFirestore } = await import('firebase-admin/firestore')

  admin.initializeApp({ credential: admin.applicationDefault() })
  const db = getFirestore()

  const batch = db.batch()
  for (const member of plan.members) {
    batch.set(db.collection('members').doc(member.email), member, { merge: true })
  }
  for (const broker of plan.brokers) {
    batch.set(db.collection('brokers').doc(broker.id), broker, { merge: true })
  }
  await batch.commit()
  console.log(
    `\nEscrito: ${plan.members.length} members, ${plan.brokers.length} brokers.`,
  )

  if (PRUNE) {
    await prune(db, 'members', plan.members.map((m) => m.email))
    await prune(db, 'brokers', plan.brokers.map((b) => b.id))
  }
}

async function prune(db, collection, keepIds) {
  const keep = new Set(keepIds)
  const snapshot = await db.collection(collection).get()
  const stale = snapshot.docs.filter((doc) => !keep.has(doc.id))
  if (stale.length === 0) {
    console.log(`prune ${collection}: nada que borrar.`)
    return
  }
  const batch = db.batch()
  for (const doc of stale) batch.delete(doc.ref)
  await batch.commit()
  console.log(`prune ${collection}: borrados ${stale.map((d) => d.id).join(', ')}`)
}

// ---------------------------------------------------------------------------

const plan = buildPlan()
printPlan(plan)

if (DRY_RUN) {
  console.log('\n--dry-run: no se escribio nada en Firestore.\n')
} else {
  console.log('\nEscribiendo en Firestore...')
  await write(plan)
  console.log('Listo.\n')
}
