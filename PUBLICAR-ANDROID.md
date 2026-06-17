# Publicar o Encanto como app Android (Google Play)

O Encanto já é um **PWA** (aplicativo web instalável). Para colocá-lo na **Google
Play** a gente "empacota" esse PWA dentro de um app Android usando a tecnologia
**TWA (Trusted Web Activity)** — o app abre o site `cabideia.com.br/encanto/` em
tela cheia, sem a barra do navegador, parecendo um app nativo.

> Você **não** reescreve nada: o app continua sendo o mesmo site. Toda atualização
> que você publica no site aparece no app automaticamente.

Identificador do app (definitivo, não muda depois de publicar):
**`br.com.cabideia.encanto`**

---

## O que já está pronto neste repositório

- ✅ **Páginas legais** exigidas pela Play:
  - Política de Privacidade: `https://cabideia.com.br/encanto/privacidade`
  - Termos de Uso: `https://cabideia.com.br/encanto/termos`
- ✅ **Arquivo de verificação** (`android/assetlinks.json`) já entra na publicação
  do site, em `https://cabideia.com.br/.well-known/assetlinks.json`. Falta só
  colar a "impressão digital" da chave (passo 4 abaixo) e publicar de novo.
- ✅ **Configuração do empacotador** (`android/twa-manifest.json`) já preenchida
  com nome, cores e ícones do app.

## O que ainda precisa ser feito (uma vez só)

Você vai precisar de:
- Uma conta de **desenvolvedor Google Play** (taxa única de US$ 25):
  https://play.google.com/console/signup
- Um computador com **Node.js** e **Java (JDK 17)** instalados.

---

## Passo 1 — Instalar o empacotador (Bubblewrap)

No terminal:

```bash
npm install -g @bubblewrap/cli
```

Na primeira vez ele se oferece para baixar o Java/Android SDK necessários —
pode aceitar.

## Passo 2 — Gerar o projeto do app

Crie uma pasta vazia (FORA deste repositório, ex.: `~/encanto-android`), copie
para dentro dela o arquivo `android/twa-manifest.json` deste repositório com o
nome `twa-manifest.json`, e rode:

```bash
cd ~/encanto-android
bubblewrap build
```

Na primeira vez ele vai pedir para **criar uma chave de assinatura** (keystore).
Anote e guarde com muito cuidado:
- a **senha do keystore** e a **senha da chave** (`alias` = `encanto`);
- o arquivo **`android.keystore`** que será criado.

> ⚠️ **Guarde o keystore e as senhas para sempre.** Se você perdê-los, nunca mais
> conseguirá publicar atualizações deste mesmo app — teria que criar um app novo.
> Faça uma cópia de segurança (ex.: no Google Drive, num lugar privado).
> **Nunca** suba o keystore nem as senhas para o GitHub.

Ao final, o Bubblewrap gera o arquivo **`app-release-bundle.aab`** — é ele que
você envia para a Play.

## Passo 3 — Criar o app na Google Play Console

1. Acesse https://play.google.com/console e crie um app novo.
2. Em **Versões → Produção** (ou faça um teste interno primeiro), envie o arquivo
   `app-release-bundle.aab`.
3. Aceite a **Assinatura de apps do Google Play** (Play App Signing) — é o padrão
   e recomendado.
4. Preencha a ficha da loja. Quando pedir a **Política de Privacidade**, informe:
   `https://cabideia.com.br/encanto/privacidade`

## Passo 4 — Conectar o app ao site (verificação)

Para o app abrir em tela cheia (sem a barra do navegador), o site precisa
"confirmar" que aquele app é oficial. Isso é feito pela impressão digital SHA-256.

1. Na Play Console, vá em **Configuração → Integridade do app → Assinatura de apps**
   e copie a **impressão digital do certificado SHA-256** (a do *certificado de
   assinatura do app*).
2. Abra o arquivo **`android/assetlinks.json`** deste repositório e substitua o
   texto `SUBSTITUA__SHA256_DA_CHAVE_DE_ASSINATURA_DO_APP_NO_GOOGLE_PLAY` pela
   impressão digital copiada (formato `AA:BB:CC:...`).
   - A segunda linha (`...CHAVE_DE_UPLOAD_OPCIONAL`) você pode preencher com a
     impressão da sua chave de upload (opcional) ou simplesmente **apagar essa
     linha**.
3. Faça commit + push. O site é republicado automaticamente (Cloudflare Pages) e o
   arquivo passa a valer em
   `https://cabideia.com.br/.well-known/assetlinks.json`.
4. Confira abrindo esse endereço no navegador — deve mostrar o conteúdo com a
   impressão digital certa.

> Dica: dá para checar a verificação com a ferramenta oficial:
> https://developers.google.com/digital-asset-links/tools/generator

## Passo 5 — Publicar

Com o `.aab` enviado, as páginas legais informadas e o `assetlinks.json`
publicado, é só enviar a versão para revisão na Play Console. A análise costuma
levar de algumas horas a alguns dias.

---

## Para lançar uma atualização do app no futuro

Na maioria das vezes **você não precisa fazer nada**: como o app é o próprio site,
qualquer mudança publicada já aparece para todos.

Você só precisa gerar um `.aab` novo e enviar à Play quando mudar algo do
"empacotamento" (ícone, nome, cor da splash). Nesse caso:
1. aumente `appVersionCode` (e, se quiser, `appVersionName`) no `twa-manifest.json`;
2. rode `bubblewrap build` de novo com o **mesmo keystore**;
3. envie o novo `.aab` na Play Console.
