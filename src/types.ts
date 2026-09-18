/**
 * Modelo de datos.
 *
 * REGLA DURA: aqui NO existe ningun campo de cliente. Ni nombre, ni telefono,
 * ni direccion de recoleccion o entrega, ni dimensiones, ni links a capturas.
 * Esa informacion vive en el Google Sheet privado y se queda ahi.
 * No agregar un campo `client` (ni equivalente) a ningun tipo de este archivo.
 */

/** Tipo de evento que otorga puntos. */
export type EntryKind =
  | 'opportunity'
  | 'extra_quote'
  | 'first_close'
  | 'reactivated_or_referral'
  | 'cold_call_quote'
  | 'cold_call_close'
  | 'big_fish'
  | 'adjustment'

export type EntryStatus = 'pending' | 'approved' | 'rejected'

export type MemberRole = 'admin' | 'viewer'

export interface Broker {
  id: string
  name: string
  email: string
  /**
   * La foto va EMBEBIDA en el documento, como data URI ('data:image/jpeg;base64,...').
   *
   * No se sirve como archivo del sitio a proposito: los archivos de GitHub
   * Pages son publicos para cualquiera, y las fotos del equipo no deben
   * quedar accesibles sin sesion. Guardarlas aqui las deja protegidas por las
   * mismas reglas de Firestore que protegen todo lo demas.
   */
  photoData?: string | null
  active: boolean
  joinedAt: string
}

/** Lista blanca. El id del documento es el correo en minusculas. */
export interface Member {
  email: string
  role: MemberRole
  brokerId: string | null
}

export interface Entry {
  id: string
  brokerId: string
  /** 'YYYY-MM-DD' en hora de Guatemala. */
  date: string
  kind: EntryKind
  points: number
  /** Para el desempate de la Fase 1: si la oportunidad llego a cotizacion enviada. */
  quoteSent: boolean
  /** Monto en USD. 0 si no hay. */
  brokerFee: number
  /** Solo el fee cobrado cuenta para el piso de $2,000. */
  feeCollected: boolean
  status: EntryStatus
  /** Nota corta del admin. SIN INFORMACION DE CLIENTE. */
  note: string
  /**
   * De donde salio la oportunidad: la columna "Load's Source" del formulario.
   * Valor de una lista cerrada (ver ENTRY_SOURCES). Nunca texto libre: si el
   * broker escribe algo en "Other:", se guarda 'Other' a secas, porque ese
   * campo abierto podria traer el nombre de un cliente.
   */
  source?: string | null
  /**
   * Identificador estable de la fila del Google Sheet que genero esta entrada.
   * Sirve para que reimportar actualice en vez de duplicar.
   * Vacio en las entradas que un admin creo a mano.
   */
  sourceId?: string | null
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface Comment {
  id: string
  brokerId: string
  text: string
  authorEmail: string
  authorName: string
  createdAt: string
}

/** Datos que se escriben desde el panel de admin. */
export type EntryDraft = Omit<Entry, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>
