// Pós-build para o Cloudflare Pages.
//
// O app é publicado na subpasta dist/encanto/ (base '/encanto/'). O Cloudflare
// Pages, para qualquer rota não encontrada, usa o "modo SPA": serve o index.html
// da RAIZ do output. Como o nosso index.html fica em dist/encanto/ (e não na
// raiz), deep links como /encanto/privacidade caíam em 404. Por isso:
//   1) _redirects manda a raiz '/' para '/encanto/' (302);
//   2) copiamos o index.html do app para a raiz (dist/index.html). Assim o
//      fallback de SPA do Pages serve o app com status 200 em qualquer deep link
//      (/encanto/privacidade, /encanto/termos, /encanto/vitrine, ...), e o React
//      Router (basename '/encanto') renderiza a rota correta no cliente.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('dist', { recursive: true })
writeFileSync('dist/_redirects', '/    /encanto/    302\n')
console.log('pós-build: dist/_redirects gerado')
copyFileSync('dist/encanto/index.html', 'dist/index.html')
console.log('pós-build: dist/index.html (fallback de SPA) gerado')
