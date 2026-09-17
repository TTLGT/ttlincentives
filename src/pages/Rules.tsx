import { Clock, Fish, ShieldCheck, Target, Trophy } from 'lucide-react'
import { ENTRY_KINDS, KIND_LABELS, POINTS_BY_KIND } from '../lib/scoring'
import { money } from '../lib/format'
import {
  BIG_FISH_MIN_FEE,
  COMPETITION_NAME,
  DAILY_SCHEDULE,
  PHASE1_TITLE,
  PHASE2_TITLE,
  PRIZE_BIG_FISH,
  PRIZE_PHASE1,
  PRIZE_PHASE2,
  QUALIFY_FEE_FLOOR,
  QUALIFY_LOADS_PER_DAY,
} from '../config/competition'

/** Las reglas completas, en texto llano, para no tener que abrir el PDF. */
export function Rules() {
  const scoring = ENTRY_KINDS.filter((kind) => kind !== 'adjustment')

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-950 sm:text-3xl dark:text-white">
          Reglas del {COMPETITION_NAME}
        </h1>
        <p className="mt-2 text-navy-600 dark:text-navy-300">
          Todo lo que hay que saber para competir. Las fechas y horas son de Guatemala.
        </p>
      </header>

      <Section icon={Trophy} title="Las dos fases">
        <div className="space-y-4">
          <div className="rounded-lg border border-navy-200 p-4 dark:border-navy-800">
            <h3 className="font-bold text-navy-950 dark:text-white">
              Fase 1 - {PHASE1_TITLE} (16 al 23 de septiembre)
            </h3>
            <p className="mt-1">
              Gana quien acumule <strong>mas oportunidades nuevas validadas</strong>. Se cuenta la
              cantidad de oportunidades, no los puntos. Premio: <strong>{PRIZE_PHASE1}</strong>.
            </p>
            <p className="mt-2 font-semibold text-navy-800 dark:text-navy-100">Si hay empate:</p>
            <ol className="mt-1 list-inside list-decimal space-y-1">
              <li>Gana quien tenga mas oportunidades que llegaron a cotizacion enviada.</li>
              <li>Si sigue el empate, gana quien tenga el broker fee confirmado mas alto de esas oportunidades.</li>
            </ol>
          </div>

          <div className="rounded-lg border border-navy-200 p-4 dark:border-navy-800">
            <h3 className="font-bold text-navy-950 dark:text-white">
              Fase 2 - Tablero continuo (desde el 24 de septiembre)
            </h3>
            <p className="mt-1">
              El tablero pasa a correr por <strong>puntos acumulados</strong>. Premio{' '}
              <strong>{PHASE2_TITLE}</strong>: <strong>{PRIZE_PHASE2}</strong>.
            </p>
          </div>
        </div>
      </Section>

      <Section icon={Target} title="Como se ganan los puntos">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-navy-200 text-xs tracking-wide text-navy-500 uppercase dark:border-navy-800 dark:text-navy-400">
              <tr>
                <th scope="col" className="py-2">Concepto</th>
                <th scope="col" className="py-2 text-right">Puntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 dark:divide-navy-800">
              {scoring.map((kind) => (
                <tr key={kind}>
                  <td className="py-2.5 pr-4 text-navy-800 dark:text-navy-100">
                    {KIND_LABELS[kind]}
                  </td>
                  <td className="tnum py-2.5 text-right text-lg font-bold text-navy-950 dark:text-white">
                    +{POINTS_BY_KIND[kind]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-gold-500/10 p-3 text-sm">
          <Fish className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-400" aria-hidden="true" />
          <span>
            <strong>Big Fish:</strong> el cierre con el broker fee mas alto del dia, siempre que pase
            de {money(BIG_FISH_MIN_FEE)}. Vale +{POINTS_BY_KIND.big_fish} puntos y{' '}
            {PRIZE_BIG_FISH} en efectivo. Corre del 24 al 30 de septiembre.
          </span>
        </p>
      </Section>

      <Section icon={ShieldCheck} title="Como se califica al premio final">
        <ul className="list-inside list-disc space-y-2">
          <li>
            Al menos <strong>{QUALIFY_LOADS_PER_DAY} carga nueva por dia</strong>, o el total
            equivalente al terminar la competencia.
          </li>
          <li>
            Al menos <strong>{money(QUALIFY_FEE_FLOOR)} de broker fee cobrado</strong>, acumulado.
            Solo cuenta el fee que ya se cobro.
          </li>
        </ul>
        <p className="mt-3">
          Quien no cumpla alguno de los dos sigue apareciendo en el tablero, pero marcado como{' '}
          <strong>no califica</strong>.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="Que cuenta y que no">
        <ul className="list-inside list-disc space-y-2">
          <li>Solo cuentan las oportunidades creadas despues de que arranco la competencia.</li>
          <li>
            No cuentan los duplicados, los registros incompletos, los inventados, ni nada que no
            tenga una solicitud de cotizacion real.
          </li>
          <li>
            Si dos brokers reclaman la misma oportunidad, es de quien la registro primero con
            evidencia.
          </li>
          <li>
            El lider de ventas valida cada registro antes de que cuente. Lo que quede en duda se
            marca <strong>pendiente</strong> y no suma nada hasta que se apruebe.
          </li>
        </ul>
      </Section>

      <Section icon={Clock} title="Ritmo diario">
        <ul className="space-y-3">
          {DAILY_SCHEDULE.map((slot) => (
            <li key={slot.time} className="flex gap-4">
              <span className="tnum w-20 shrink-0 font-bold text-navy-950 dark:text-white">
                {slot.time}
              </span>
              <span>
                <strong className="text-navy-900 dark:text-navy-100">{slot.label}.</strong>{' '}
                {slot.detail}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-navy-500 dark:text-navy-400">
          Todas las horas son de Guatemala (UTC-6). El corte de las 3:00 PM es el que cierra el dia.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="Privacidad">
        <p>
          Este tablero <strong>no guarda ni muestra informacion de clientes</strong>: ni nombres, ni
          telefonos, ni direcciones de recoleccion o entrega, ni dimensiones de carga, ni capturas de
          cotizaciones. Esa informacion se queda en la hoja privada del equipo.
        </p>
        <p className="mt-2">
          Lo que si se guarda aqui: que broker, que dia, que tipo de punto, cuantos puntos, el monto
          del broker fee y una nota del administrador.
        </p>
        <p className="mt-2">
          Los montos de broker fee los ve <strong>todo el que tiene acceso al sitio</strong>. Es a
          proposito y el equipo lo acordo asi.
        </p>
      </Section>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Trophy
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-navy-950 dark:text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3 text-navy-700 dark:text-navy-200">{children}</div>
    </section>
  )
}
