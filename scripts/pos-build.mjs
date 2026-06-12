// Pós-build: escreve dist/_redirects para o Cloudflare Pages.
//  1) quem abrir a raiz é levado para /encanto/
//  2) qualquer rota interna (ex.: /encanto/vitrine) abre o app (SPA), sem erro 404
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('dist', { recursive: true })
writeFileSync(
  'dist/_redirects',
  '/                /encanto/                302\n/encanto/*       /encanto/index.html      200\n'
)
console.log('pós-build: dist/_redirects gerado')
