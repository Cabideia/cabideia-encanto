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
      // ── M-023 · Leitura offline ──────────────────────────────────────────
      // O app shell (HTML/JS/CSS) já é pré-cacheado e versionado a cada build
      // pelo generateSW. Aqui adicionamos:
      //  • cleanupOutdatedCaches: ao ativar um deploy novo, limpa o cache antigo
      //    para nunca servir uma versão velha do app (cuidado técnico do M-023);
      //  • navigateFallback: reabrir uma rota da SPA offline serve o shell;
      //  • runtimeCaching: leituras e imagens públicas com cache de fallback.
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/encanto/index.html',
        runtimeCaching: [
          {
            // Dados (leituras Supabase / PostgREST GET): network-first.
            // Online sempre busca fresco; offline serve o último estado salvo.
            urlPattern: /\/rest\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'encanto-dados',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Imagens públicas (vitrine/acervo no bucket 'publico'). Signed URLs
            // de bucket privado expiram e não entram aqui — quando faltam, a tela
            // mostra placeholder em vez de quebrar.
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'encanto-imagens',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fontes do Google: o shell offline mantém a tipografia da marca.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'encanto-fontes',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
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
