/**
 * Toda la configuracion de la competencia vive AQUI.
 * Si cambian las fechas o las reglas, se cambian en este archivo y en ningun otro lado.
 *
 * Zona horaria: America/Guatemala (UTC-6, sin horario de verano).
 */

export const COMPETITION_NAME = 'Independence Sales Sprint'
export const COMPANY_NAME = 'Total Transport Logistics'

/** Zona horaria unica de toda la aplicacion. Guatemala es UTC-6 fijo. */
export const TIMEZONE = 'America/Guatemala'
export const TIMEZONE_OFFSET_HOURS = -6

/** Hora del corte diario (hora de Guatemala). A esta hora se valida y se publica el tablero. */
export const DAILY_CUTOFF_HOUR = 15

/** Ritmo diario que se muestra como recordatorio en el sitio. */
export const DAILY_SCHEDULE = [
  { time: '8:00 AM', label: 'Meta del dia', detail: 'Cada broker publica su meta del dia.' },
  { time: '1:00 PM', label: 'Update rapido', detail: 'Actualizacion corta de avance.' },
  { time: '3:00 PM', label: 'Corte diario', detail: 'Cierre, validacion y publicacion del tablero.' },
] as const

// ---------------------------------------------------------------------------
// Fechas (siempre 'YYYY-MM-DD' en hora de Guatemala)
// ---------------------------------------------------------------------------

/** FASE 1 - "TOP HUNTER": se gana por CANTIDAD de oportunidades validadas. */
export const PHASE1_START = '2026-09-16'
export const PHASE1_END = '2026-09-23'

/** FASE 2 - tablero continuo por PUNTOS. */
export const PHASE2_START = '2026-09-24'

/**
 * Cierre de la Fase 2. Confirmado por Erwin: 30 de septiembre de 2026, igual
 * que la ventana de "Big Fish". Si algun dia cambia, se cambia SOLO esta linea.
 */
export const PHASE2_END = '2026-09-30'

/** "Big Fish" corre del 24 al 30 de septiembre. */
export const BIG_FISH_START = '2026-09-24'
export const BIG_FISH_END = '2026-09-30'

/** Primer y ultimo dia de toda la competencia. */
export const COMPETITION_START = PHASE1_START
export const COMPETITION_END = PHASE2_END

// ---------------------------------------------------------------------------
// Banderas de reglas pendientes de confirmar
// ---------------------------------------------------------------------------

/**
 * Puntos de bono (first_close, extra_quote, cold_call_*,
 * reactivated_or_referral, big_fish) durante la Fase 1.
 *
 * Confirmado por Erwin, y como esta construido:
 *   - La Fase 1 SIEMPRE se decide por cantidad de oportunidades validadas.
 *     Los bonos nunca cambian el ranking de la Fase 1.
 *   - Con esta bandera en `true`, los bonos ganados entre el 16 y el 23 de
 *     septiembre SI se acumulan en el tablero continuo de puntos.
 *   - Ponerla en `false` hace que los bonos solo sumen a partir del 24.
 *
 * Es una sola bandera: cambiar este valor recalcula todo el sitio.
 */
export const BONUS_POINTS_COUNT_IN_PHASE1 = true

/**
 * "Cotizaciones nuevas = +1 cada una".
 *
 * Confirmado por Erwin: CADA cotizacion nueva vale +1, sin importar si el
 * broker ya habia hecho una antes ese dia. No hay umbral ni minimo diario que
 * superar para empezar a sumar: la primera cotizacion del dia vale igual que
 * la cuarta.
 *
 * El admin registra una entrada `extra_quote` por cada cotizacion nueva.
 *
 * Ojo, son dos cosas distintas: el minimo de UNA CARGA por dia sigue vivo,
 * pero es un requisito para CALIFICAR al premio final (ver QUALIFY_LOADS_PER_DAY),
 * no un umbral para que las cotizaciones empiecen a puntear.
 */
export const QUOTE_POINTS_HAVE_NO_DAILY_THRESHOLD = true

// ---------------------------------------------------------------------------
// Requisitos para calificar al premio final
// ---------------------------------------------------------------------------

/** Minimo de broker fee COBRADO acumulado para calificar (USD). */
export const QUALIFY_FEE_FLOOR = 2000

/** Minimo de cargas nuevas por dia (o el total equivalente al final). */
export const QUALIFY_LOADS_PER_DAY = 1

/** Un "Big Fish" solo cuenta si el broker fee supera este monto. */
export const BIG_FISH_MIN_FEE = 500

// ---------------------------------------------------------------------------
// Premios
// ---------------------------------------------------------------------------

export const PRIZE_PHASE1 = 'Q500'
export const PRIZE_PHASE2 = 'Q500'
export const PRIZE_BIG_FISH = 'Q50'
export const PHASE1_TITLE = 'TOP HUNTER'
export const PHASE2_TITLE = 'TOP SPRINT WINNER'

// ---------------------------------------------------------------------------
// Cuentas con acceso de administrador.
// Esta lista DEBE coincidir con firestore.rules y con data/members.json.
// ---------------------------------------------------------------------------

export const ADMIN_EMAILS = [
  'operations@totaltransportlogistics.us',
  'erwin@totaltransportlogistics.us',
] as const

export const ALLOWED_EMAIL_DOMAIN = 'totaltransportlogistics.us'
