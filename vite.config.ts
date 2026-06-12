import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base '/encanto/': o app vive como rota sob a marca-mãe (cabideia.com.br/encanto/)
export default defineConfig({
  base: '/encanto/',
  // O app é servido sob /encanto/. Publicamos os arquivos dentro de dist/encanto
  // e um _redirects (gerado no pós-build) manda a raiz para /encanto/ e cobre o
  // roteamento da SPA. Assim funciona igual no preview .pages.dev e em produção.
  build: { outDir: 'dist/encanto', emptyOutDir: true },
  plugins: [
    react(),
    // generateSW versiona o cache a cada build automaticamente
    // (cobre a lição: "versionar cache do service worker a cada release")
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icones/icone-192.png', 'icones/icone-512.png'],
      manifest: {
        name: 'Cabideia Encanto',
        short_name: 'Encanto',
        description:
          'Vitrine, acervo e inspirações de quem trabalha por encomenda · da casa Cabideia',
        lang: 'pt-BR',
        start_url: '/encanto/',
        scope: '/encanto/',
        display: 'standalone',
        background_color: '#FFF6F1',
        theme_color: '#FFF6F1',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icones/icone-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
