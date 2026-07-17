# Deploy das prévias (Cloudflare Pages) — diagnóstico e correção

**Data:** 17/07/2026 · **Sintoma:** prévia da branch no celular = tela bege, app
não carrega; o `index.html` publicado aponta `/src/main.tsx`.

## Topologia (como o Encanto chega no ar)

- **Produção** — `cabideia.com.br/encanto/*` passa pelo worker `encanto-router`,
  que repassa para o projeto Pages **`cabideia-encanto-app`** (recebe upload
  direto do `dist/` já buildado).
- **Prévias** — o projeto Pages **`cabideia-encanto`** é integrado a este
  repositório no GitHub: cada push de branch gera um deploy de prévia
  (`<branch>.cabideia-encanto.pages.dev`) e um check "Cloudflare Pages" no
  commit.

## Diagnóstico (por que a tela bege)

O projeto de prévias estava **sem comando de build** no painel. Sem build, o
Pages publica o diretório de saída como está — e, sem diretório configurado, a
**raiz do repositório**. Evidências:

1. Os checks "Cloudflare Pages" dos PRs #7, #38 e #39 duram **0 segundos**
   (started == completed) e "passam": nunca houve build, só upload do fonte.
2. Por isso o `index.html` publicado é o **fonte** (aponta
   `<script type="module" src="/src/main.tsx">`). O navegador não executa TSX
   (e o Pages nem serve `.tsx` como JavaScript) — o React nunca monta, e o que
   sobra é o fundo bege (`#F2EBDF`, o `theme-color`/fundo do shell).
3. O build local do mesmo commit gera `dist/` correto (o `index.html` buildado
   aponta `/encanto/assets/index-<hash>.js`). O problema é 100% do deploy, não
   do código da branch.

Ninguém viu antes porque esta foi a primeira prévia realmente aberta — produção
não passa por esse projeto.

## Correção

### No repositório (este commit)

- **`wrangler.toml`** — `pages_build_output_dir = "dist"`: o diretório de saída
  passa a ser versionado e lido pelo build de prévia; publicar a raiz do repo
  deixa de ser possível. *Enquanto o comando de build não estiver no painel, o
  deploy de prévia agora FALHA explicitamente (dist/ não existe sem build) — de
  propósito: melhor um check vermelho que uma prévia quebrada no ar.*
- **`.nvmrc`** — Node 22 (o mesmo do build local; Vite 5 exige ≥18).

### No painel do Cloudflare (gestão/Josiane — não é versionável)

Projeto **`cabideia-encanto`** → Settings → Build & deployments:

1. **Build command:** `npm run build`
   (o Pages instala as dependências sozinho pelo `package-lock.json`).
2. **Retry deployment** no último deploy da branch (ou um push novo).

> **Variáveis de build:** com o `wrangler.toml` presente, o Pages IGNORA as
> variáveis cadastradas no painel (visto no log: "Build environment variables:
> (none found)"). Elas agora são declaradas no próprio `wrangler.toml`
> (`[vars]` e `[env.preview.vars]`) — são valores públicos (URL do projeto e
> chave publishable/anon; o RLS é quem protege os dados). Chave secreta nunca
> entra lá.

### Para o teste da Josiane logar na prévia

O login (Google/PKCE) só volta para origens autorizadas: adicionar
`https://*.cabideia-encanto.pages.dev/*` nas **Redirect URLs** do Supabase
(Auth → URL Configuration). Sem isso a prévia abre, mas o login não completa.

## Conferência de que funcionou

O check "Cloudflare Pages" do commit passa a demorar ~1–2 min; a prévia abre a
tela de entrada e o selo de versão no rodapé (M-046) mostra
`semver · SHA · dd/mm hh:mm` do commit da branch.
