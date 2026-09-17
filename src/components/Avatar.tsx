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
  broker: Pick<Broker, 'id' | 'name' | 'photoPath'>
  size?: keyof typeof SIZES
  ring?: boolean
}

/**
 * Foto del broker, con las iniciales como respaldo.
 *
 * El sitio debe verse terminado con cero fotos en public/photos/, asi que el
 * respaldo no es un placeholder gris: es un circulo de marca con iniciales.
 */
export function Avatar({ broker, size = 'md', ring = false }: Props) {
  const [failed, setFailed] = useState(false)
  const src = import.meta.env.BASE_URL + (broker.photoPath || `photos/${broker.id}.jpg`)

  const base = `${SIZES[size]} shrink-0 rounded-full object-cover ${
    ring ? 'ring-3 ring-white dark:ring-navy-700' : ''
  }`

  if (failed) {
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
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${base} bg-navy-200 dark:bg-navy-800`}
    />
  )
}
