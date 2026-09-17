import { useEffect, useState } from 'react'
import { countdownTo } from '../lib/dates'

interface Props {
  target: Date
  label: string
}

/** Cuenta regresiva al corte de la fase. Se actualiza cada segundo. */
export function Countdown({ target, label }: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const c = countdownTo(target, now)

  if (c.finished) {
    return (
      <div className="text-center sm:text-right">
        <p className="text-xs font-semibold tracking-widest text-navy-200 uppercase">{label}</p>
        <p className="text-2xl font-bold text-white">Cerrado</p>
      </div>
    )
  }

  return (
    <div className="text-center sm:text-right">
      <p className="text-xs font-semibold tracking-widest text-navy-200 uppercase">{label}</p>
      <div className="mt-1 flex items-end justify-center gap-1 sm:justify-end">
        <Unit value={c.days} suffix="d" />
        <Unit value={c.hours} suffix="h" />
        <Unit value={c.minutes} suffix="m" />
        <Unit value={c.seconds} suffix="s" />
      </div>
    </div>
  )
}

function Unit({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="tnum text-2xl leading-none font-bold text-white sm:text-3xl">
      {String(value).padStart(2, '0')}
      <span className="text-sm font-semibold text-navy-200">{suffix}</span>
    </span>
  )
}
