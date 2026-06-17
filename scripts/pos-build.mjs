// Pós-build: escreve dist/_redirects para o Cloudflare Pages.
//  1) quem abrir a raiz é levado para /encanto/
//  2) qualquer rota interna (ex.: /encanto/vitrine) abre o app (SPA), sem erro 404
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('dist', { recursive: true })
writeFileSync(
  'dist/_redirects',
  '/                /encanto/                302\n/encanto/*       /encanto/index.html      200\n'
)
console.log('pós-build: dist/_redirects gerado')

// Digital Asset Links: o app Android (TWA) só abre em tela cheia, sem a barra do
// navegador, se este arquivo for servido na RAIZ do domínio. Como cabideia.com.br
// é servido por este mesmo projeto (o _redirects acima manda "/" para "/encanto/"),
// publicamos o arquivo em dist/.well-known/assetlinks.json — a regra de redirect
// só casa com "/" exato, então o arquivo é servido como está.
mkdirSync('dist/.well-known', { recursive: true })
copyFileSync('android/assetlinks.json', 'dist/.well-known/assetlinks.json')
console.log('pós-build: dist/.well-known/assetlinks.json gerado')
