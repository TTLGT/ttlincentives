import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// El sitio se publica en GitHub Pages bajo https://<usuario>.github.io/ttlincentives/
// Si algun dia se mueve a un dominio propio, cambiar `base` a '/'.
export default defineConfig({
  base: '/ttlincentives/',
  plugins: [react(), tailwindcss()],
})
