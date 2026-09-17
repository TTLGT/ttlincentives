import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { SignIn } from './components/SignIn'
import { Leaderboard } from './pages/Leaderboard'
import { Charts } from './pages/Charts'
import { BrokerPage } from './pages/BrokerPage'
import { Admin } from './pages/Admin'
import { Rules } from './pages/Rules'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          {/*
            HashRouter y no BrowserRouter: GitHub Pages sirve archivos estaticos
            y devuelve 404 en cualquier ruta que no exista como archivo. Con el
            hash, recargar en /broker/... o compartir el link siempre funciona.
          */}
          <HashRouter>
            <Gate />
          </HashRouter>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

/**
 * Puerta de entrada.
 *
 * Sin sesion aprobada no se monta ninguna pantalla con datos: se devuelve la
 * pantalla de ingreso y punto. De todas formas, aunque alguien se saltara esto,
 * firestore.rules no le entregaria un solo documento.
 */
function Gate() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy-900">
        <p className="text-sm font-semibold tracking-wide text-navy-200 uppercase">Cargando...</p>
      </div>
    )
  }

  if (status !== 'ready') return <SignIn />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Leaderboard />} />
        <Route path="graficas" element={<Charts />} />
        <Route path="broker/:id" element={<BrokerPage />} />
        <Route path="reglas" element={<Rules />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
