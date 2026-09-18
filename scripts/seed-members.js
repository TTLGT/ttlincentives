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

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = resolve(HERE, '..', 'data', 'members.json')

/**
 * Carpeta local con las fotos. NO se sube al repositorio (esta en .gitignore).
 *
 * Las fotos se guardan dentro del documento de cada broker en Firestore, no
 * como archivos del sitio: lo que se publica en GitHub Pages lo puede bajar
 * cualquiera sin iniciar sesion. Desde Firestore, las protegen las mismas
 * reglas que el resto de los datos.
 */
const PHOTOS_DIR = resolve(HERE, '..', 'photos-source')

/**
 * Las fotos se reducen a 400x400 antes de subirlas.
 *
 * Las que salen de Drive vienen de camara: 400 KB a 2 MB cada una. Un
 * documento de Firestore no puede pasar de 1 MB, y guardar la imagen en
 * base64 la infla como un 33%, asi que sin reducir casi ninguna entraria.
 * Reducidas quedan en unos 20-40 KB.
 */
const PHOTO_SIZE = 400
const PHOTO_QUALITY = 82

/**
 * Limite sobre la cadena base64 YA CODIFICADA, que es lo que de verdad ocupa
 * el documento. No sobre el archivo original.
 */
const MAX_ENCODED_BYTES = 600 * 1024

const PHOTO_TYPES = [
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]

/**
 * Normaliza un nombre de archivo para compararlo con el id del broker.
 *
 * Las fotos vienen de Drive con el nombre que sea: "ALEX FLORES.jpg",
 * "Alex Flores.JPG", "alex_flores.jpeg". Todas esas caen en 'alex-flores',
 * que es el id. Asi no hay que renombrar 25 archivos a mano.
 *
 * Misma logica que toBrokerId() en src/lib/format.ts.
 */
function normalizeKey(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Indexa photos-source/ una sola vez: clave normalizada -> archivo. */
function indexPhotos() {
  const index = new Map()
  if (!existsSync(PHOTOS_DIR)) return index

  for (const file of readdirSync(PHOTOS_DIR)) {
    const ext = extname(file).toLowerCase()
    const type = PHOTO_TYPES.find(([e]) => e === ext)
    if (!type) continue
    const key = normalizeKey(basename(file, extname(file)))
    if (!key) continue
    // Si dos archivos normalizan igual, gana el primero y se avisa despues.
    if (index.has(key)) {
      index.get(key).duplicates.push(file)
      continue
    }
    index.set(key, { file, mime: type[1], duplicates: [], used: false })
  }
  return index
}

const PHOTO_INDEX = indexPhotos()

/** sharp es opcional: si falta, se sube la foto tal cual y se avisa. */
let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.warn(
    '\nAviso: falta sharp, asi que las fotos NO se van a reducir.\n' +
      'Instalalo con:  npm install -D sharp\n' +
      'Sin el, cualquier foto de camara va a salir demasiado grande.\n',
  )
}

/**
 * Busca la foto de un broker, la reduce a 400x400 y la devuelve como data URI.
 * Devuelve null si no hay archivo para ese broker.
 */
async function readPhoto(broker) {
  // Por id ('alex-flores'), y si no, por su nombre ('ALEX FLORES').
  const entry = PHOTO_INDEX.get(broker.id) ?? PHOTO_INDEX.get(normalizeKey(broker.name))
  if (!entry) return null

  entry.used = true
  const original = readFileSync(resolve(PHOTOS_DIR, entry.file))

  let bytes = original
  let mime = entry.mime
  if (sharp) {
    try {
      // 'attention' recorta hacia la parte con mas informacion visual, que en
      // un retrato suele ser la cara, en vez de cortar siempre por el centro.
      bytes = await sharp(original)
        .rotate() // respeta la orientacion EXIF; si no, algunas salen acostadas
        .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: PHOTO_QUALITY })
        .toBuffer()
      mime = 'image/jpeg'
    } catch (err) {
      return { name: entry.file, error: `no se pudo procesar (${err.message})` }
    }
  }

  const base64 = bytes.toString('base64')
  if (base64.length > MAX_ENCODED_BYTES) {
    return {
      name: entry.file,
      error: `queda en ${(base64.length / 1024).toFixed(0)} KB codificada (maximo ${MAX_ENCODED_BYTES / 1024} KB)`,
    }
  }

  return {
    dataUri: `data:${mime};base64,${base64}`,
    originalBytes: original.length,
    bytes: bytes.length,
    encodedBytes: base64.length,
    name: entry.file,
    duplicates: entry.duplicates,
  }
}

/** Busca el id mas parecido, para sugerirlo cuando una foto no coincide. */
function closestId(key, ids) {
  const parts = key.split('-').filter(Boolean)
  let best = null
  let bestScore = 0
  for (const id of ids) {
    const idParts = id.split('-')
    let score = 0
    for (const part of parts) {
      // Cuenta un apellido igual, o un nombre que empieza igual (Jose/Joseph).
      if (idParts.some((p) => p === part || p.startsWith(part) || part.startsWith(p))) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  return bestScore > 0 ? best : null
}

/** Archivos que quedaron sin dueno: casi siempre un nombre mal escrito. */
function unmatchedPhotos() {
  return [...PHOTO_INDEX.entries()]
    .filter(([, entry]) => !entry.used)
    .map(([key, entry]) => ({ key, file: entry.file }))
}

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

async function buildPlan() {
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
    const doc = {
      id: broker.id,
      name: broker.name,
      email: key,
      active: true,
      joinedAt,
    }

    // photoData solo se incluye si de verdad hay archivo. Asi, correr el seed
    // sin la carpeta de fotos NO borra las que ya estan cargadas.
    const photo = await readPhoto(broker)
    if (photo?.dataUri) doc.photoData = photo.dataUri
    doc._photo = photo

    brokers.push(doc)
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
  let withPhoto = 0
  const oversized = []
  for (const b of brokers) {
    let note = 'sin foto (se muestran las iniciales)'
    if (b._photo?.error) {
      note = `FOTO IGNORADA: ${b._photo.error}`
      oversized.push(b.id)
    } else if (b._photo?.dataUri) {
      note = `${b._photo.name}  ${(b._photo.originalBytes / 1024).toFixed(0)} KB -> ${(b._photo.encodedBytes / 1024).toFixed(0)} KB`
      withPhoto++
    }
    console.log(`  ${b.id.padEnd(20)} ${b.name.padEnd(20)} ${note}`)
  }

  const admins = members.filter((m) => m.role === 'admin').length
  console.log(
    `\nResumen: ${admins} admin(s), ${members.length - admins} viewer(s), ${brokers.length} brokers.`,
  )
  console.log(`Fotos encontradas en photos-source/: ${withPhoto} de ${brokers.length}.`)
  if (withPhoto === 0) {
    console.log('(Los brokers sin foto salen con sus iniciales. El sitio se ve terminado igual.)')
  }
  if (oversized.length > 0) {
    console.log(`\nOJO: estas fotos pesan de mas y NO se van a subir: ${oversized.join(', ')}`)
    console.log('Reducilas a 400x400 y volve a correr.')
  }

  // Lo mas facil de no notar: una foto que no le toca a nadie. Sin este aviso
  // el broker sale con iniciales y parece que el script simplemente fallo.
  const orphans = unmatchedPhotos()
  if (orphans.length > 0) {
    console.log(`\nOJO: ${orphans.length} foto(s) en photos-source/ no coinciden con ningun broker:`)
    for (const o of orphans) {
      const guess = closestId(o.key, brokers.map((b) => b.id))
      const hint = guess ? `  (quiza querias '${guess}'?)` : ''
      console.log(`  ${o.file}  ->  no hay broker con id '${o.key}'${hint}`)
    }
    console.log('Revisa como esta escrito el nombre contra los ids de data/members.json.')
  }

  const dupes = brokers.filter((b) => b._photo?.duplicates?.length > 0)
  if (dupes.length > 0) {
    console.log('\nOJO: hay mas de un archivo para el mismo broker. Se usa el primero:')
    for (const b of dupes) {
      console.log(`  ${b.id}: se usa ${b._photo.name}, se ignoran ${b._photo.duplicates.join(', ')}`)
    }
  }
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
    const { _photo, ...doc } = broker
    void _photo
    batch.set(db.collection('brokers').doc(broker.id), doc, { merge: true })
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

const plan = await buildPlan()
printPlan(plan)

if (DRY_RUN) {
  console.log('\n--dry-run: no se escribio nada en Firestore.\n')
} else {
  console.log('\nEscribiendo en Firestore...')
  await write(plan)
  console.log('Listo.\n')
}
