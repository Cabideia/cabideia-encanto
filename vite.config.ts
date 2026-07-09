import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// --- Indicador de versão (pedido da Josiane) ----------------------------------
// O número é montado NO BUILD e injetado como constante de compilação (define).
// Por ser uma constante dentro do bundle JS (que tem hash no nome), quando o
// service worker serve um bundle antigo do cache ele carrega o número antigo:
// o que aparece na tela É sempre o do bundle que está rodando, nunca um valor
// à parte que pode ficar defasado. Se a Josiane vê o número novo, o SW atualizou.
//
// Três partes:
//  · semver  → rótulo legível por fase (vem do package.json)
//  · SHA     → prova exatamente qual commit gerou o bundle
//  · data/hora do build → sempre avança a cada deploy; ela confere contra o
//    horário em que subiu o merge (não depende de contagem de commits, que o
//    Cloudflare Pages poderia travar com clone raso).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// SHA curto: no Cloudflare Pages vem pronto em CF_PAGES_COMMIT_SHA; no dev/local
// caímos no git. Se nada disso existir (ex.: build fora de um repo), fica 'dev'.
function shaCurto(): string {
  const doPages = process.env.CF_PAGES_COMMIT_SHA
  if (doPages) return doPages.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Data/hora do build no fuso da Josiane (Brasil), formato compacto "09/07 15:41".
// pt-BR devolve "09/07, 15:41" — tiramos a vírgula para caber discreto no rodapé.
function horaBuild(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
    .format(new Date())
    .replace(', ', ' ')
}

// base '/encanto/': o app vive como rota sob a marca-mãe (cabideia.com.br/encanto/)
export default defineConfig({
  base: '/encanto/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(shaCurto()),
    __BUILD_TIME__: JSON.stringify(horaBuild())
  },
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
        background_color: '#F2EBDF',
        theme_color: '#F2EBDF',
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
