// Versão visível do app (pedido da Josiane, para confirmar no device que o
// deploy já subiu antes de testar).
//
// As três partes são constantes de compilação injetadas no build (vite.config.ts).
// Como ficam DENTRO do bundle JS versionado por hash, o texto abaixo reflete
// sempre o bundle realmente carregado — se o service worker servir um bundle
// antigo do cache, aparece o número antigo. Ver o comentário em vite.config.ts.
//
// Formato: "v0.2.0 · 09/07 15:41 · a1b2c3d"
//   semver ─┘          │            └─ SHA curto do commit (prova o bundle)
//              data/hora do build (avança a cada deploy; confere com o horário do merge)
export const VERSAO = `v${__APP_VERSION__} · ${__BUILD_TIME__} · ${__BUILD_SHA__}`
