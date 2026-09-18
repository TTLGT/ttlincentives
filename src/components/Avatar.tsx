import { useState } from 'react'
import { initials } from '../lib/format'
import type { Broker } from '../types'

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
  hero: 'h-28 w-28 text-3xl sm:h-32 sm:w-32 sm:text-4xl',
} as const

interface Props {
  broker: Pick<Broker, 'id' | 'name' | 'photoData'>
  size?: keyof typeof SIZES
  ring?: boolean
}

/**
 * Foto del broker, con las iniciales como respaldo.
 *
 * La imagen viene EMBEBIDA en el documento del broker (data URI), no de un
 * archivo del sitio. Es a proposito: cualquier archivo publicado en GitHub
 * Pages lo puede bajar cualquiera sin iniciar sesion, y las fotos del equipo
 * no deben quedar expuestas asi. Viniendo de Firestore, las protegen las
 * mismas reglas que protegen el resto de los datos.
 *
 * El sitio debe verse terminado con cero fotos cargadas, asi que el respaldo
 * no es un placeholder gris: es un circulo de marca con las iniciales.
 */
export function Avatar({ broker, size = 'md', ring = false }: Props) {
  const [failed, setFailed] = useState(false)

  const base = `${SIZES[size]} shrink-0 rounded-full object-cover ${
    ring ? 'ring-3 ring-white dark:ring-navy-700' : ''
  }`

  if (!broker.photoData || failed) {
    return (
      <div
        className={`${base} flex items-center justify-center bg-navy-700 font-bold tracking-wide text-white dark:bg-navy-600`}
        aria-hidden="true"
      >
        {initials(broker.name)}
      </div>
    )
  }

  return (
    <img
      src={broker.photoData}
      alt=""
      onError={() => setFailed(true)}
      className={`${base} bg-navy-200 dark:bg-navy-800`}
    />
  )
}
