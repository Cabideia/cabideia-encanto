import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraTopo } from '../components/BarraTopo'
import { Confirmar } from '../components/Confirmar'
import { Icone } from '../components/Icone'
import { useAviso } from '../components/Toast'
import { useSessao } from '../hooks/useSessao'
import { useClientes } from '../hooks/useClientes'
import { usePropostas, type CamposProposta, type ModoPreco } from '../hooks/usePropostas'
import { usePedidos } from '../hooks/usePedidos'
import { useAcervo } from '../hooks/useAcervo'
import { useInspiracoes, dominioDe } from '../hooks/useInspiracoes'
import { usePropostaReferencias } from '../hooks/usePropostaReferencias'
import { usePropostaItens } from '../hooks/usePropostaItens'
import { useGuardaSaida } from '../hooks/useGuardaSaida'
import { formatarReal, precoParaNumero } from '../hooks/useCardapio'
import { formatarDataNumerica } from '../lib/datas'
import { comprimirImagem } from '../lib/imagem'
import { supabase } from '../lib/supabase'
import { cartaoParaPng, desenharProposta } from '../lib/proposta'

/**
 * Rascunhos automáticos (opção A) criados NESTA sessão de navegação — ids de
 * propostas que nasceram só para permitir anexar filhos na criação. Só esses
 * podem ser descartados se ficarem vazios; propostas abertas direto da ficha
 * nunca entram aqui (segurança: nunca apagamos trabalho real da dona). O Set
 * zera num reload da página (aí preservamos por precaução).
 */
const rascunhosAbertos = new Set<string>()

/**
 * BUG-012 · limite dos textos longos (descrição/condições). O banco aceita mais
 * (text sem limite); o teto é só de UX. O contador fica âmbar perto do fim para
 * a dona perceber antes de o campo parar de aceitar digitação.
 */
const LIMITE_TEXTO_LONGO = 2000
const ALERTA_TEXTO_LONGO = 1800

/** Contador {n}/{limite} exibido abaixo dos campos de texto longo. */
function ContadorCaracteres({ atual }: { atual: number }) {
  const pertoDoLimite = atual >= ALERTA_TEXTO_LONGO
  return (
    <div
      className="apoio"
      style={{ textAlign: 'right', marginTop: 4, ...(pertoDoLimite ? { color: 'var(--caramelo)' } : null) }}
      aria-live={pertoDoLimite ? 'polite' : undefined}
    >
      {atual}/{LIMITE_TEXTO_LONGO}
    </div>
  )
}

/** Carrega um Blob como ImageBitmap (null em caso de falha — o cartão segue sem ele). */
async function bitmapDeBlob(blob: Blob | null): Promise<ImageBitmap | null> {
  if (!blob) return null
  try {
    return await createImageBitmap(blob)
  } catch {
    return null
  }
}

/**
 * Proposta encantadora — agora NASCE da cliente e fica salva (tabela `propostas`).
 *
 * Cria/edita uma proposta (título, descrição, valor, validade, foto opcional) e
 * monta o cartão (PNG) com foto + título + descrição + valor + validade + a logo
 * do perfil, para compartilhar no WhatsApp da cliente. A foto é comprimida no
 * cliente (M-009) e guardada no bucket público — não conta como trabalho.
 */
export function PropostaForm() {
  // /clientes/:clienteId/propostas/nova  (criação)  ·  /propostas/:id  (edição)
  const { clienteId, id } = useParams()
  const edicao = !!id
  const navegar = useNavigate()
  const { sessao } = useSessao()
  const avisar = useAviso()

  const { carregando: carregandoClientes, buscarPorId: buscarCliente } = useClientes(sessao?.user.id)
  const {
    carregando: carregandoPropostas,
    salvando,
    buscarPorId: buscarProposta,
    subirFoto,
    criar,
    atualizar,
    garantirToken,
    excluir,
  } = usePropostas(sessao?.user.id)

  // M-039/M-042 · o pedido que nasceu desta proposta (base do "Virar/Ver pedido").
  const { pedidoDaProposta } = usePedidos(sessao?.user.id)

  // M-042 F2a · Fotos de referência multi-origem (proposta_referencias). O hook é
  // enxuto (só ids + ordem); aqui cruzamos com trabalhos/inspirações p/ as imagens.
  const { trabalhos } = useAcervo(sessao?.user.id)
  const { inspiracoes } = useInspiracoes(sessao?.user.id)
  const { referencias, carregando: carregandoRefs, remover: removerReferencia, garantirFotosPublicas } =
    usePropostaReferencias(sessao?.user.id, id)

  // M-042 F2a I3 · itens do cardápio ofertados (snapshot). Gerenciados ao vivo,
  // como as referências — não passam pelo salvar() do form.
  const { itens: itensProposta, carregando: carregandoItensProp, remover: removerItem } =
    usePropostaItens(sessao?.user.id, id)

  const proposta = edicao && id ? buscarProposta(id) : undefined
  const clienteIdAtivo = clienteId ?? proposta?.cliente_id ?? null
  const cliente = clienteIdAtivo ? buscarCliente(clienteIdAtivo) : undefined
  const pedidoDaEdicao = edicao && id ? pedidoDaProposta(id) : undefined

  // Campos editáveis
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [validade, setValidade] = useState('') // 'YYYY-MM-DD'
  const [modoPreco, setModoPreco] = useState<ModoPreco>('fechado') // I3
  const [condicoes, setCondicoes] = useState('') // I4
  const [condicoesPadrao, setCondicoesPadrao] = useState<string | null>(null)
  const [salvandoPadrao, setSalvandoPadrao] = useState(false)

  // Foto: caminho já salvo + blob novo a subir (compressão no cliente).
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [fotoBitmap, setFotoBitmap] = useState<ImageBitmap | null>(null)
  const [logoBitmap, setLogoBitmap] = useState<ImageBitmap | null>(null)
  const [nomeNegocio, setNomeNegocio] = useState('')
  const blobNovo = useRef<Blob | null>(null)

  const [fontesProntas, setFontesProntas] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [aExcluir, setAExcluir] = useState(false)
  const [confirmarSaida, setConfirmarSaida] = useState(false) // M3

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputFoto = useRef<HTMLInputElement>(null)
  const prefilled = useRef(false)
  const perfilCarregado = useRef(false)
  // Limpeza do rascunho vazio (opção A): refs lidos no unmount, sempre atuais.
  const idRef = useRef<string | undefined>(id)
  const saindoParaFilho = useRef(false) // indo a um picker/lote → NÃO limpar
  const rascunhoVazioRef = useRef(false)

  // Garante as fontes (Fraunces / Nunito Sans) antes de desenhar texto no canvas.
  useEffect(() => {
    let vivo = true
    document.fonts.ready.then(() => vivo && setFontesProntas(true))
    return () => {
      vivo = false
    }
  }, [])

  // Perfil: nome do negócio + logo (bucket público) — uma vez.
  useEffect(() => {
    if (perfilCarregado.current || !sessao) return
    perfilCarregado.current = true
    supabase
      .from('perfis')
      .select('nome_negocio, logo_path, condicoes_padrao')
      .eq('id', sessao.user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return
        setNomeNegocio(data.nome_negocio ?? '')
        setCondicoesPadrao(data.condicoes_padrao ?? null)
        // I4: nova proposta NASCE com o padrão do perfil (só se ainda vazia).
        if (!edicao && data.condicoes_padrao)
          setCondicoes((atual) => atual || data.condicoes_padrao)
        if (data.logo_path) {
          const { data: arquivo } = await supabase.storage.from('publico').download(data.logo_path)
          const bmp = await bitmapDeBlob(arquivo ?? null)
          if (bmp) setLogoBitmap(bmp)
        }
      })
  }, [sessao, edicao])

  // Pré-preenche no modo edição (uma vez, quando a proposta carrega).
  useEffect(() => {
    if (!edicao || prefilled.current || !proposta) return
    prefilled.current = true
    setTitulo(proposta.titulo ?? '')
    setDescricao(proposta.descricao ?? '')
    setValor(proposta.valor != null ? String(proposta.valor).replace('.', ',') : '')
    setValidade(proposta.validade ?? '')
    // Propostas antigas (modo_preco null) caem em 'fechado' — mesma exibição de antes.
    setModoPreco(proposta.modo_preco ?? 'fechado')
    // I4: na edição, mostra só o que foi salvo (proposta antiga sem condições fica vazia).
    setCondicoes(proposta.condicoes ?? '')
    setFotoPath(proposta.foto_path)
    if (proposta.foto_path) {
      supabase.storage
        .from('publico')
        .download(proposta.foto_path)
        .then(({ data }) => bitmapDeBlob(data ?? null))
        .then((bmp) => bmp && setFotoBitmap(bmp))
    }
  }, [edicao, proposta])

  // Descarta o rascunho automático se a dona sair da tela (unmount) sem NADA
  // nele. Só age em rascunhos criados nesta navegação (nunca em propostas
  // abertas da ficha) e nunca quando estamos indo a um picker/lote.
  useEffect(() => {
    return () => {
      const rid = idRef.current
      if (
        rid &&
        rascunhosAbertos.has(rid) &&
        !saindoParaFilho.current &&
        rascunhoVazioRef.current
      ) {
        rascunhosAbertos.delete(rid)
        // Sem foto/filhos: é só a linha da proposta (fire-and-forget).
        supabase.from('propostas').delete().eq('id', rid)
      }
    }
  }, [])

  const valorNum = precoParaNumero(valor)
  // M2 · "Valor fechado" e "Itens da tabela" mostram o número quando houver
  // (no modo itens o valor é o TOTAL — o que a cliente paga; os itens são o
  // detalhamento). Sem número, ou no modo "Sem preço": "A combinar". O
  // detalhamento dos itens no cartão/página é F2b.
  const valorTexto =
    modoPreco !== 'sem' && valorNum != null ? formatarReal(valorNum) : 'A combinar'

  // Veredito conservador de "rascunho vazio", atualizado a cada render p/ o
  // unmount ler. Só é vazio com TUDO ausente E os filhos já carregados (na
  // dúvida — ainda carregando —, NÃO é vazio, então preserva). Condições que
  // apenas repetem o padrão do perfil (auto-preenchimento do I4) não contam
  // como conteúdo digitado.
  idRef.current = id
  rascunhoVazioRef.current =
    !carregandoRefs &&
    !carregandoItensProp &&
    referencias.length === 0 &&
    itensProposta.length === 0 &&
    !titulo.trim() &&
    !descricao.trim() &&
    valorNum == null &&
    !validade &&
    !fotoPath &&
    !blobNovo.current &&
    (condicoes.trim() === '' || condicoes.trim() === (condicoesPadrao ?? '').trim())
  const validadeTexto = validade ? `Válido até ${formatarDataNumerica(validade)}` : ''

  // M3 · Há conteúdo NÃO salvo? Fotos/itens são gravados ao vivo — não entram
  // aqui; só os campos do form (que dependem do "Salvar") e a capa pendente. Em
  // criação pura (sem registro ainda) qualquer conteúdo conta; já com registro,
  // comparamos com o que está salvo. Condições que só repetem o padrão do perfil
  // não contam (auto-preenchimento do I4). Rascunho vazio abandonado NÃO é
  // "alteração": sai em silêncio (e a limpeza automática o descarta).
  function haAlteracoes(): boolean {
    if (blobNovo.current) return true // capa nova ainda não subiu
    const tituloN = titulo.trim() || null
    const descricaoN = descricao.trim() || null
    const condicoesN = condicoes.trim() || null
    const validadeN = validade || null
    if (!proposta) {
      // Criação pura: sem registro salvo, qualquer conteúdo digitado é "não salvo".
      const condProprias = condicoesN != null && condicoesN !== (condicoesPadrao ?? '').trim()
      return (
        !!tituloN || !!descricaoN || valorNum != null || !!validadeN || !!fotoPath || condProprias
      )
    }
    return (
      tituloN !== (proposta.titulo ?? null) ||
      descricaoN !== (proposta.descricao ?? null) ||
      valorNum !== (proposta.valor ?? null) ||
      validadeN !== (proposta.validade ?? null) ||
      modoPreco !== (proposta.modo_preco ?? 'fechado') ||
      condicoesN !== (proposta.condicoes ?? null)
    )
  }

  // M3 · guarda de saída: intercepta a seta do app (aoVoltar) e o back nativo,
  // com o MESMO comportamento — inclusive já na "Nova proposta" (título digitado
  // é trabalho iniciado). Não arma na tela "não encontrada" nem enquanto uma
  // proposta existente ainda carrega.
  const { tentarSair, sair, navegarLimpo } = useGuardaSaida({
    ativo: !edicao || !!proposta,
    temAlteracoes: haAlteracoes,
    aoPedirConfirmacao: () => setConfirmarSaida(true),
  })

  // Redesenha o cartão sempre que algo muda (e quando as fontes carregam).
  useEffect(() => {
    if (!fontesProntas || !canvasRef.current) return
    desenharProposta(canvasRef.current, {
      fotoBitmap,
      logoBitmap,
      nomeNegocio,
      titulo,
      descricao,
      cliente: cliente?.nome ?? '',
      valorTexto,
      validadeTexto,
    })
  }, [fontesProntas, fotoBitmap, logoBitmap, nomeNegocio, titulo, descricao, cliente, valorTexto, validadeTexto])

  const semFoto = !fotoBitmap

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setProcessandoFoto(true)
    try {
      const { blob } = await comprimirImagem(f)
      blobNovo.current = blob
      const bmp = await bitmapDeBlob(blob)
      if (bmp) {
        setFotoBitmap((antigo) => {
          antigo?.close()
          return bmp
        })
      } else {
        avisar('Não consegui usar essa foto. Tente outra.')
      }
    } catch (err: unknown) {
      avisar((err as Error)?.message ?? 'Não consegui processar a foto.')
    } finally {
      setProcessandoFoto(false)
    }
  }

  function campos(caminhoFoto: string | null): CamposProposta {
    // Decisão A do I3: guardamos o valor digitado independentemente do modo —
    // alternar não apaga dado; `modo_preco` só decide o que exibir.
    return {
      titulo,
      descricao,
      valor: valorNum,
      validade: validade || null,
      foto_path: caminhoFoto,
      modo_preco: modoPreco,
      condicoes: condicoes.trim() || null,
    }
  }

  // I4 · Grava as condições atuais como padrão do perfil (vale p/ próximas propostas).
  async function salvarComoPadrao() {
    if (!sessao || !condicoes.trim()) return
    setSalvandoPadrao(true)
    const texto = condicoes.trim()
    const { error } = await supabase
      .from('perfis')
      .update({ condicoes_padrao: texto })
      .eq('id', sessao.user.id)
    setSalvandoPadrao(false)
    if (error) {
      avisar('Não consegui salvar o padrão. Tente de novo.')
      return
    }
    setCondicoesPadrao(texto)
    avisar('Condições salvas como padrão ✓')
  }

  /** Garante que a foto nova (se houver) esteja no storage; devolve o caminho. */
  async function garantirFoto(): Promise<{ path: string | null } | { erro: string }> {
    if (!blobNovo.current) return { path: fotoPath }
    const up = await subirFoto(blobNovo.current)
    if ('erro' in up) return { erro: up.erro }
    blobNovo.current = null
    setFotoPath(up.path)
    return { path: up.path }
  }

  async function salvar() {
    if (!clienteIdAtivo) {
      avisar('Proposta sem cliente.')
      return
    }
    const foto = await garantirFoto()
    if ('erro' in foto) {
      avisar(foto.erro)
      return
    }
    if (edicao && id) {
      const erro = await atualizar(id, campos(foto.path), proposta?.foto_path ?? null)
      if (erro) {
        avisar(erro)
        return
      }
      // Save explícito: deixa de ser rascunho descartável (é decisão da dona).
      rascunhosAbertos.delete(id)
      avisar('Proposta salva ✓')
    } else {
      const res = await criar(clienteIdAtivo, campos(foto.path))
      if ('erro' in res) {
        avisar(res.erro)
        return
      }
      avisar('Proposta salva ✓')
      // B2 · troca "/nova" pela proposta real colapsando a sentinela (M3), para
      // o "voltar" da proposta salva cair direto na origem, sem "/nova" fantasma.
      navegarLimpo(() => navegar(`/propostas/${res.id}`, { replace: true }))
    }
  }

  /**
   * Rascunho automático (fix de fluxo, opção A): garante um `proposta_id` para
   * gravar os filhos (fotos/inspirações/itens) SEM a dona salvar e reabrir. Na
   * edição já existe; na criação, salva a proposta atual de forma transparente
   * (com o que já foi digitado + a capa pendente) e devolve o id. O picker que
   * abre em seguida volta para /propostas/:id, onde o form recarrega tudo.
   */
  async function garantirProposta(): Promise<{ id: string; criou: boolean } | null> {
    if (!clienteIdAtivo) {
      avisar('Proposta sem cliente.')
      return null
    }
    const foto = await garantirFoto()
    if ('erro' in foto) {
      avisar(foto.erro)
      return null
    }
    // B1 · Já existe: PERSISTE o estado atual do form (modo_preco, título, valor…)
    // antes de abrir o picker. Sem isso, ao voltar o form remonta e relê valores
    // velhos do banco — o modo escolhido reverte para "fechado" e os itens já
    // lançados ficam ocultos.
    if (id) {
      const erro = await atualizar(id, campos(foto.path), proposta?.foto_path ?? null)
      if (erro) {
        avisar(erro)
        return null
      }
      return { id, criou: false }
    }
    const res = await criar(clienteIdAtivo, campos(foto.path))
    if ('erro' in res) {
      avisar(res.erro)
      return null
    }
    // Nasceu como rascunho: elegível a descarte se ficar vazio (opção A).
    rascunhosAbertos.add(res.id)
    return { id: res.id, criou: true }
  }

  /**
   * Abre um filho (picker/lote) da proposta. B2 · via `navegarLimpo`, que colapsa
   * a sentinela do aviso (M3) antes de navegar: na criação, troca a entrada
   * "/nova" pela proposta real (replace) e empurra o filho — o "voltar" do filho
   * cai na proposta, e o "voltar" da proposta vai direto à origem, sem telas
   * empilhadas nem form em branco.
   */
  async function abrirFilho(destino: (pid: string) => string) {
    saindoParaFilho.current = true
    const res = await garantirProposta()
    if (!res) {
      saindoParaFilho.current = false
      return
    }
    const { id: pid, criou } = res
    navegarLimpo(() => {
      if (criou) navegar(`/propostas/${pid}`, { replace: true })
      navegar(destino(pid))
    })
  }
  const abrirPickerFotos = () => abrirFilho((pid) => `/propostas/${pid}/referencias`)
  const abrirLoteInspiracoes = () => abrirFilho((pid) => `/inspiracoes/lote?proposta=${pid}`)
  const abrirPickerItens = () => abrirFilho((pid) => `/propostas/${pid}/itens`)

  const gerarPng = useCallback(async (): Promise<Blob | null> => {
    if (!canvasRef.current) return null
    try {
      return await cartaoParaPng(canvasRef.current)
    } catch {
      avisar('Não consegui gerar a imagem. Tente de novo.')
      return null
    }
  }, [avisar])

  function baixar(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proposta-${(titulo || nomeNegocio || 'cabideia').toLowerCase().replace(/\s+/g, '-')}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  // F2b · o link é o conteúdo principal (o PNG virou capa opcional, D3-A). A
  // mensagem inclui o link da página pública quando ele já existe.
  function mensagemWhats(link?: string): string {
    const nome = cliente?.nome?.split(' ')[0]
    return [
      nome ? `Oi, ${nome}! 💛` : 'Oi! 💛',
      titulo.trim() ? `Preparei sua proposta: ${titulo.trim()}` : 'Preparei sua proposta:',
      descricao.trim(),
      `Valor: ${valorTexto}`,
      validadeTexto,
      link ? `Veja tudo aqui: ${link}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  /** URL da página pública da proposta (mesmo domínio do link de seleção). */
  function linkProposta(token: string): string {
    return `https://cabideia.com.br/encanto/proposta/${token}`
  }

  /**
   * F2b · CTA primário — Compartilhar no WhatsApp mandando o LINK (resolve o B3:
   * o PNG saía incompleto). Persiste a proposta (rascunho, se preciso), gera/reusa
   * o token, garante as cópias públicas das fotos e abre o WhatsApp com o texto
   * pronto + o link. Não exige foto (o link mostra tudo).
   */
  async function compartilhar() {
    saindoParaFilho.current = true // persistir aqui não pode descartar o rascunho
    setCompartilhando(true)
    let idCriado: string | null = null // proposta recém-criada a adotar (replace)
    try {
      const res = await garantirProposta()
      if (!res) return
      if (res.criou) idCriado = res.id
      const token = await garantirToken(res.id)
      if (!token) {
        avisar('Não consegui gerar o link. Tente de novo.')
        return
      }
      // BUG-011 · cópias públicas das fotos de referência (idempotente). Se
      // alguma falhar, aborta o envio — não manda um link com fotos quebradas.
      const falhaFotos = await garantirFotosPublicas(res.id)
      if (falhaFotos) {
        avisar(falhaFotos.erro)
        return
      }
      const texto = mensagemWhats(linkProposta(token))
      const numero = (cliente?.whatsapp ?? '').replace(/\D/g, '')
      const alvo = numero
        ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
        : `https://wa.me/?text=${encodeURIComponent(texto)}`
      window.open(alvo, '_blank', 'noopener')
    } finally {
      setCompartilhando(false)
      // Criação: colapsa a "/nova" pela proposta real (edição), como abrirFilho —
      // adota o rascunho SEMPRE que foi criado, mesmo se algo acima falhou (não
      // deixa órfão nem gera duplicata no próximo "Salvar"). Em edição, libera a
      // guarda do rascunho.
      if (idCriado) navegarLimpo(() => navegar(`/propostas/${idCriado}`, { replace: true }))
      else saindoParaFilho.current = false
    }
  }

  async function baixarImagem() {
    if (semFoto) {
      avisar('Adicione uma foto à proposta.')
      return
    }
    const blob = await gerarPng()
    if (!blob) return
    baixar(blob)
    avisar('Imagem baixada ✓')
  }

  function abrirWhatsAppCliente() {
    const numero = (cliente?.whatsapp ?? '').replace(/\D/g, '')
    if (!numero) return
    // Se a proposta já tem link (token), manda junto; senão, só a conversa.
    const texto = mensagemWhats(proposta?.token ? linkProposta(proposta.token) : undefined)
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  // Tira só a referência da proposta — nunca apaga o trabalho/inspiração.
  async function aoRemoverReferencia(refId: string) {
    const erro = await removerReferencia(refId)
    if (erro) avisar(erro)
  }

  // Tira o item da proposta (não mexe no cardápio).
  async function aoRemoverItem(itemId: string) {
    const erro = await removerItem(itemId)
    if (erro) avisar(erro)
  }

  async function confirmarExcluir() {
    if (!proposta) return
    saindoParaFilho.current = true // já estamos apagando; unmount não repete
    const erro = await excluir(proposta)
    if (erro) {
      saindoParaFilho.current = false
      avisar(erro)
      setAExcluir(false)
      return
    }
    if (id) rascunhosAbertos.delete(id)
    avisar('Proposta excluída')
    navegar(clienteIdAtivo ? `/clientes/${clienteIdAtivo}` : '/clientes', { replace: true })
  }

  // Espera carregar os dados necessários.
  if (carregandoClientes || (edicao && carregandoPropostas)) return null

  if (edicao && !carregandoPropostas && !proposta) {
    return (
      <div className="tela">
        <BarraTopo titulo="Proposta" />
        <div className="conteudo">
          <div className="vazio" style={{ marginTop: 16 }}>
            <div className="icone"><Icone nome="busca" size={44} /></div>
            <p>Esta proposta não foi encontrada.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <BarraTopo
        titulo={edicao ? 'Proposta' : 'Nova proposta'}
        aoVoltar={tentarSair}
        acao={
          edicao ? (
            <button className="btn-icone" onClick={() => setAExcluir(true)} aria-label="Excluir proposta">
              <Icone nome="lixo" />
            </button>
          ) : undefined
        }
      />

      <div className="conteudo">
        {/* M-042 · reuso do M-039: virar pedido (ou ir ao pedido já criado) */}
        {edicao && (
          <button
            type="button"
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
            onClick={() => {
              saindoParaFilho.current = true // sair para o pedido não descarta
              navegar(
                pedidoDaEdicao ? `/pedidos/${pedidoDaEdicao.id}` : `/pedidos/novo?proposta=${id}`
              )
            }}
          >
            <Icone nome="pedidos" size={16} /> {pedidoDaEdicao ? 'Ver pedido' : 'Virar pedido'}
          </button>
        )}

        {/* M-042 F2a · Fotos de referência (proposta_referencias). Visível já na
            criação: ao tocar, o rascunho automático salva a proposta e abre o
            picker (opção A). Tocar na miniatura abre a origem; o × tira só a
            referência — nunca apaga o trabalho/inspiração. */}
        <div style={{ marginBottom: 14 }}>
          <div className="secao"><span className="confeito" /><h2>Fotos de referência</h2></div>
            {referencias.length > 0 && (
              <div className="grade-fotos" style={{ alignItems: 'start', marginBottom: 12 }}>
                {referencias.map((r) => {
                  if (r.origem === 'trabalho') {
                    const t = trabalhos.find((x) => x.id === r.trabalho_id)
                    if (!t) return null
                    return (
                      <div className="foto-item" key={r.id}>
                        <div
                          className="acervo-img-wrap"
                          role="button"
                          tabIndex={0}
                          onClick={() => navegar(`/acervo?t=${t.id}`)}
                          onKeyDown={(e) => e.key === 'Enter' && navegar(`/acervo?t=${t.id}`)}
                        >
                          <img src={t.url} alt={t.descricao ?? ''} loading="lazy" />
                          {t.codigo_num != null && (
                            <span className="cod-selo" aria-label={`Código A-${t.codigo_num}`}>A-{t.codigo_num}</span>
                          )}
                          <button
                            className="foto-remover"
                            onClick={(e) => { e.stopPropagation(); aoRemoverReferencia(r.id) }}
                            aria-label="Tirar esta foto da proposta"
                          >
                            <Icone nome="fechar" size={15} />
                          </button>
                        </div>
                      </div>
                    )
                  }
                  const insp = inspiracoes.find((x) => x.id === r.inspiracao_id)
                  if (!insp) return null
                  return (
                    <div className="foto-item" key={r.id}>
                      <div
                        className="acervo-img-wrap"
                        role="button"
                        tabIndex={0}
                        onClick={() => navegar(`/inspiracoes/${insp.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navegar(`/inspiracoes/${insp.id}`)}
                      >
                        {insp.fotoUrl ? (
                          <img src={insp.fotoUrl} alt={insp.nota ?? ''} loading="lazy" />
                        ) : (
                          <div className="insp-link-capa">
                            <span className="insp-link-emoji" aria-hidden><Icone nome="link" size={30} /></span>
                            <span className="insp-link-dominio">{insp.url ? dominioDe(insp.url) : 'link'}</span>
                          </div>
                        )}
                        {insp.codigo_num != null && (
                          <span className="cod-selo" aria-label={`Código I-${insp.codigo_num}`}>I-{insp.codigo_num}</span>
                        )}
                        <button
                          className="foto-remover"
                          onClick={(e) => { e.stopPropagation(); aoRemoverReferencia(r.id) }}
                          aria-label="Tirar esta foto da proposta"
                        >
                          <Icone nome="fechar" size={15} />
                        </button>
                      </div>
                      {insp.nota && <div className="foto-legenda">{insp.nota}</div>}
                    </div>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={abrirPickerFotos}
              disabled={salvando || processandoFoto}
            >
              <Icone nome="imagem" size={16} />{' '}
              {referencias.length > 0 ? 'Adicionar mais fotos' : 'Selecionar fotos'}
            </button>
            {/* M-042 F2a I2 · lote do M-040 no modo proposta: sobe novas inspirações
                e elas voltam já anexadas em proposta_referencias. */}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              onClick={abrirLoteInspiracoes}
              disabled={salvando || processandoFoto}
            >
              <Icone nome="camera" size={16} /> Incluir novas inspirações
            </button>
        </div>

        {/* Prévia do cartão (canvas 1080×1440 exibido reduzido) */}
        <canvas ref={canvasRef} className="proposta-previa" aria-label="Prévia da proposta" />

        {semFoto && (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 10, color: 'var(--framboesa)', fontWeight: 700 }}>
            Adicione uma foto para deixar a proposta encantadora.
          </p>
        )}

        {/* Foto */}
        <input ref={inputFoto} type="file" accept="image/*" style={{ display: 'none' }} onChange={aoEscolherFoto} />
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}
          onClick={() => inputFoto.current?.click()}
          disabled={processandoFoto}
        >
          {processandoFoto ? 'Processando…' : <><Icone nome="imagem" size={16} /> {semFoto ? 'Adicionar foto' : 'Trocar foto'}</>}
        </button>

        {/* Título */}
        <div className="campo" style={{ marginTop: 14 }}>
          <label>Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Bolo de casamento 3 andares"
            maxLength={80}
          />
        </div>

        {/* Descrição */}
        <div className="campo">
          <label>Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: massa de baunilha, recheio de brigadeiro, topo personalizado…"
            maxLength={LIMITE_TEXTO_LONGO}
          />
          <ContadorCaracteres atual={descricao.length} />
        </div>

        {/* Preço em 3 modos (I3) — exclusivos na exibição; alternar não apaga dado. */}
        <div className="campo">
          <label>Preço</label>
          <div className="escolha" style={{ marginTop: 2 }}>
            <button
              type="button"
              className={`filtro${modoPreco === 'fechado' ? ' ativo' : ''}`}
              onClick={() => setModoPreco('fechado')}
            >
              Valor fechado
            </button>
            <button
              type="button"
              className={`filtro${modoPreco === 'itens' ? ' ativo' : ''}`}
              onClick={() => setModoPreco('itens')}
            >
              Itens da tabela
            </button>
            <button
              type="button"
              className={`filtro${modoPreco === 'sem' ? ' ativo' : ''}`}
              onClick={() => setModoPreco('sem')}
            >
              Sem preço
            </button>
          </div>
        </div>

        {modoPreco === 'fechado' && (
          <div className="campo">
            <label>Valor (R$)</label>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex.: 120,00"
              inputMode="decimal"
            />
            <div className="apoio" style={{ marginTop: 6 }}>
              No cartão: <b>{valorTexto}</b>
            </div>
          </div>
        )}

        {modoPreco === 'itens' && (
          <div className="campo">
            <label>Itens da tabela</label>
            {itensProposta.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {itensProposta.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      border: '1px solid var(--linha)',
                      borderRadius: 12,
                      marginBottom: 8,
                      background: 'var(--acucar)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{it.nome_snapshot}</span>
                    <span style={{ fontWeight: 700, color: 'var(--framboesa)', flexShrink: 0 }}>
                      {it.preco_snapshot != null ? formatarReal(it.preco_snapshot) : 'sem preço'}
                    </span>
                    <button
                      type="button"
                      className="btn-icone"
                      onClick={() => aoRemoverItem(it.id)}
                      aria-label="Tirar este item da proposta"
                    >
                      <Icone nome="fechar" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn-secundario"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={abrirPickerItens}
              disabled={salvando || processandoFoto}
            >
              <Icone nome="precos" size={16} />{' '}
              {itensProposta.length > 0 ? 'Adicionar mais itens' : 'Selecionar itens'}
            </button>

            {/* M2 · valor total opcional junto com os itens (reusa propostas.valor).
                Os itens são o detalhamento; o total é o que a cliente paga. */}
            <div style={{ marginTop: 14 }}>
              <label>Valor total (R$) — opcional</label>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex.: 120,00"
                inputMode="decimal"
              />
              <div className="apoio" style={{ marginTop: 6 }}>
                No cartão: <b>{valorTexto}</b>
                {valorNum == null && ' (preencha para mostrar o total)'}
              </div>
            </div>
          </div>
        )}

        {modoPreco === 'sem' && (
          <p className="apoio" style={{ marginBottom: 4 }}>
            Sem valor — a proposta mostra só o portfólio e a tabela de preços.
          </p>
        )}

        {/* Validade */}
        <div className="campo">
          <label>Validade (opcional)</label>
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
        </div>

        {/* Condições (I4) — nasce do padrão do perfil; pode virar o novo padrão. */}
        <div className="campo">
          <label>Condições (opcional)</label>
          <textarea
            value={condicoes}
            onChange={(e) => setCondicoes(e.target.value)}
            placeholder="Ex.: 50% de entrada, 7 dias úteis de antecedência, Pix ou dinheiro"
            maxLength={LIMITE_TEXTO_LONGO}
          />
          <ContadorCaracteres atual={condicoes.length} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="button"
              className="tag-criar"
              onClick={salvarComoPadrao}
              disabled={salvandoPadrao || !condicoes.trim() || condicoes.trim() === (condicoesPadrao ?? '')}
            >
              {salvandoPadrao ? 'Salvando…' : 'Salvar como padrão'}
            </button>
          </div>
        </div>

        {/* F2b · CTA de compartilhamento manda o LINK (o PNG virou capa opcional).
            Não exige foto — a página pública mostra tudo. */}
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          onClick={compartilhar}
          disabled={compartilhando || salvando || processandoFoto}
        >
          {compartilhando ? 'Preparando o link…' : <><Icone nome="compartilhar" size={16} /> Compartilhar no WhatsApp</>}
        </button>
        <button
          type="button"
          className="btn-secundario"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={baixarImagem}
          disabled={semFoto}
        >
          <Icone nome="baixar" size={16} /> Baixar imagem (capa)
        </button>
        {cliente?.whatsapp && (
          <button
            type="button"
            className="btn-secundario"
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
            onClick={abrirWhatsAppCliente}
          >
            <Icone nome="whatsapp" size={16} /> Abrir conversa de {cliente.nome.split(' ')[0]}
          </button>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 14 }}>
          A proposta fica salva na ficha da cliente. A foto não conta como trabalho.
        </p>
      </div>

      {/* CTA primário fixo: salvar */}
      <div className="cta-area">
        <button type="button" className="cta" onClick={salvar} disabled={salvando || processandoFoto}>
          {salvando ? 'Salvando…' : edicao ? 'Salvar alterações' : 'Salvar proposta'}
        </button>
      </div>

      {aExcluir && (
        <Confirmar
          titulo="Excluir esta proposta?"
          descricao="Esta ação não pode ser desfeita."
          rotuloConfirmar="Excluir proposta"
          onConfirmar={confirmarExcluir}
          onCancelar={() => setAExcluir(false)}
        />
      )}

      {/* M3 · aviso "sair sem salvar" quando há conteúdo não salvo no form. */}
      {confirmarSaida && (
        <Confirmar
          titulo="Sair sem salvar?"
          descricao="Você tem alterações que ainda não foram salvas nesta proposta."
          rotuloConfirmar="Sair sem salvar"
          onConfirmar={() => {
            setConfirmarSaida(false)
            sair()
          }}
          onCancelar={() => setConfirmarSaida(false)}
        />
      )}
    </div>
  )
}
