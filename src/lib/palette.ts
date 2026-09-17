/**
 * Paleta de las graficas.
 *
 * Los ocho colores estan validados para daltonismo (protan, deutan, tritan)
 * contra las dos superficies reales del sitio: blanco en modo claro y
 * azul marino #0b2545 en modo oscuro. No cambiar un hex sin volver a validar:
 * el orden de los slots ES el mecanismo de seguridad, no es decoracion.
 *
 * Limite duro: 8 series con color propio. El broker numero 9 en adelante se
 * dibuja en gris neutro bajo la etiqueta "Otros". Generar colores nuevos por
 * broker haria la grafica ilegible justo donde mas se ve, en la TV de la
 * oficina. Para ver a un broker especifico esta el filtro y la leyenda.
 */

/** Cuantas series llevan color propio antes de caer a "Otros". */
export const MAX_COLORED_SERIES = 8

const CATEGORICAL_LIGHT = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aqua
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
] as const

const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const

/** Gris neutro para las series que caen fuera de los ocho slots. */
const OTHER_LIGHT = '#898781'
const OTHER_DARK = '#7d8ba3'

export interface ChartTheme {
  categorical: readonly string[]
  other: string
  surface: string
  text: string
  textMuted: string
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
  good: string
  warning: string
  critical: string
}

const LIGHT_THEME: ChartTheme = {
  categorical: CATEGORICAL_LIGHT,
  other: OTHER_LIGHT,
  surface: '#ffffff',
  text: '#0b2545',
  textMuted: '#52514e',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(11,37,69,0.18)',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
}

const DARK_THEME: ChartTheme = {
  categorical: CATEGORICAL_DARK,
  other: OTHER_DARK,
  surface: '#0b2545',
  text: '#ffffff',
  textMuted: '#aec5e5',
  grid: '#163361',
  axis: '#1f4478',
  tooltipBg: '#0f2649',
  tooltipBorder: 'rgba(255,255,255,0.18)',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
}

export function chartTheme(dark: boolean): ChartTheme {
  return dark ? DARK_THEME : LIGHT_THEME
}

/**
 * Color de una serie por su POSICION EN LA LISTA DE COLOREADAS, no por su rank.
 * Se construye un mapa id -> color una sola vez para que filtrar la grafica
 * nunca repinte a los que quedan.
 */
export function buildColorMap(ids: string[], dark: boolean): Record<string, string> {
  const theme = chartTheme(dark)
  const map: Record<string, string> = {}
  ids.forEach((id, index) => {
    map[id] = index < MAX_COLORED_SERIES ? theme.categorical[index] : theme.other
  })
  return map
}

/** Escala secuencial de un solo tono (azul) para magnitudes continuas. */
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
] as const
