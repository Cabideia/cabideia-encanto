// Pós-build para o Cloudflare Pages.
//
// O app é publicado na subpasta dist/encanto/ (base '/encanto/'). Deep links como
// /encanto/privacidade não correspondem a nenhum arquivo estático, então sem uma
// regra explícita o Pages devolve 404 (o fallback implícito de SPA é frágil e já
// quebrou em produção). Por isso o _redirects faz, em ordem:
//   1) /                → /encanto/            302  (a raiz leva ao app)
//   2) /encanto/*        → /encanto/index.html 200  (SPA fallback explícito: toda
//      rota desconhecida sob /encanto/ serve o index.html do app com status 200,
//      e o React Router (basename '/encanto') renderiza a rota no cliente).
//   Arquivos estáticos existentes (/encanto/assets/...) têm precedência sobre a
//   regra de splat, então o bundle continua sendo servido normalmente.
// Também copiamos o index.html do app para a raiz (dist/index.html) como rede de
// segurança adicional para o fallback implícito do Pages.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('dist', { recursive: true })
writeFileSync(
  'dist/_redirects',
  ['/                /encanto/              302', '/encanto/*       /encanto/index.html    200', ''].join('\n')
)
console.log('pós-build: dist/_redirects gerado (raiz + SPA fallback /encanto/*)')
copyFileSync('dist/encanto/index.html', 'dist/index.html')
console.log('pós-build: dist/index.html (fallback de SPA) gerado')
