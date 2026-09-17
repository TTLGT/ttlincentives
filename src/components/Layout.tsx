import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, BookOpen, LogOut, Menu, Moon, ShieldCheck, Sun, Trophy, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { COMPANY_NAME, COMPETITION_NAME, DAILY_SCHEDULE } from '../config/competition'

const LINKS = [
  { to: '/', label: 'Tablero', icon: Trophy, end: true },
  { to: '/graficas', label: 'Graficas', icon: BarChart3, end: false },
  { to: '/reglas', label: 'Reglas', icon: BookOpen, end: false },
]

export function Layout() {
  const { user, isAdmin, signOutNow } = useAuth()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = isAdmin
    ? [...LINKS, { to: '/admin', label: 'Admin', icon: ShieldCheck, end: false }]
    : LINKS

  return (
    <div className="min-h-dvh bg-navy-50 dark:bg-navy-950">
      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="min-w-0 flex-1" onClick={() => setMenuOpen(false)}>
            <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-navy-300 uppercase">
              {COMPANY_NAME}
            </p>
            <p className="truncate text-base font-bold sm:text-lg">{COMPETITION_NAME}</p>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {links.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggle}
              className="rounded-lg p-2 text-navy-200 hover:bg-navy-800 hover:text-white"
              aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-2 text-navy-200 hover:bg-navy-800 hover:text-white md:hidden"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={signOutNow}
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-white md:flex"
              title={user?.email ?? undefined}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-40 truncate">{user?.email}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-navy-800 px-4 py-2 md:hidden" aria-label="Principal movil">
            {links.map((link) => (
              <NavItem key={link.to} {...link} block onClick={() => setMenuOpen(false)} />
            ))}
            <button
              type="button"
              onClick={signOutNow}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-navy-200 hover:bg-navy-800"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Cerrar sesion ({user?.email})
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-navy-200 px-4 py-6 sm:px-6 dark:border-navy-800">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-navy-600 dark:text-navy-300">
            {DAILY_SCHEDULE.map((slot) => (
              <li key={slot.time}>
                <span className="tnum font-bold text-navy-900 dark:text-white">{slot.time}</span>{' '}
                {slot.label}
              </li>
            ))}
          </ul>
          <p className="text-xs text-navy-500 dark:text-navy-400">
            Horas de Guatemala. Este tablero no guarda informacion de clientes.
          </p>
        </div>
      </footer>
    </div>
  )
}

interface NavItemProps {
  to: string
  label: string
  icon: typeof Trophy
  end: boolean
  block?: boolean
  onClick?: () => void
}

function NavItem({ to, label, icon: Icon, end, block, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          block ? 'flex w-full' : 'flex',
          'items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive ? 'bg-white text-navy-900' : 'text-navy-200 hover:bg-navy-800 hover:text-white',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </NavLink>
  )
}
