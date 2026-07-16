import { useEffect, useRef, useState } from 'react'
import { useAviso } from './Toast'
import { Icone } from './Icone'
import { useSessao } from '../hooks/useSessao'
import { supabase } from '../lib/supabase'
import { BUCKET_PUBLICO, urlPublica } from '../lib/storage'
import { SEM_CONEXAO, estaOffline } from '../lib/conexao'

/**
 * M-017 · Formulário de perfil reaproveitável.
 *
 * Mesma lógica de leitura/gravação em `perfis` que vivia na página Perfil.
 * Renderiza só os campos + o botão de salvar, para poder ser usado tanto na
 * rota /perfil quanto dentro de um sheet na Minha Vitrine (edição inline).
 * Ao salvar com sucesso, chama `onSalvo()`.
 */

const NICHOS = ['doces', 'crochê', 'cestas', 'artesanato', 'personalizados', 'outro']

// Mesma regra do banco: começa com letra/número, 3–30 chars, [a-z0-9._-]
const REGRA_ARROBA = /^[a-z0-9][a-z0-9._-]{2,29}$/

// M-038 · Logo: formatos aceitos (a extensão acompanha o tipo real) e teto de 1 MB.
// A logo NÃO passa pela compressão de fotos (M-009) — preservamos o arquivo
// original para manter a transparência (PNG).
const TIPOS_LOGO: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const LOGO_MAX_BYTES = 1024 * 1024 // 1 MB

type Props = {
  /** Chamado após salvar com sucesso. */
  onSalvo: () => void
  /** Quando true, mostra um botão "Cancelar" (uso em sheet). */
  onCancelar?: () => void
}

export function PerfilForm({ onSalvo, onCancelar }: Props) {
  const { sessao } = useSessao()
  const avisar = useAviso()

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erroArroba, setErroArroba] = useState<string | null>(null)

  const [nomeNegocio, setNomeNegocio] = useState('')
  const [arroba, setArroba] = useState('')
  const [bio, setBio] = useState('')
  const [cidade, setCidade] = useState('')
  const [nicho, setNicho] = useState('doces')
  const [whatsapp, setWhatsapp] = useState('')

  // Logo: caminho já salvo + intenção pendente (arquivo novo OU remoção) aplicada
  // ao salvar. O preview pode ser a URL pública (logo atual) ou uma object URL
  // local (arquivo recém-escolhido) — `objetoUrl` guarda a object URL p/ revogar.
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoRemover, setLogoRemover] = useState(false)
  const inputLogo = useRef<HTMLInputElement>(null)
  const objetoUrl = useRef<string | null>(null)

  // Carrega o perfil existente (se houver).
  useEffect(() => {
    if (!sessao) return
    supabase
      .from('perfis')
      .select('nome_negocio, arroba, bio, cidade, nicho, whatsapp, logo_path')
      .eq('id', sessao.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNomeNegocio(data.nome_negocio ?? '')
          setArroba(data.arroba ?? '')
          setBio(data.bio ?? '')
          setCidade(data.cidade ?? '')
          setNicho(data.nicho ?? 'doces')
          setWhatsapp(data.whatsapp ?? '')
          setLogoPath(data.logo_path ?? null)
          if (data.logo_path) setLogoPreview(urlPublica(data.logo_path))
        }
        setCarregando(false)
      })
  }, [sessao])

  // Revoga a object URL pendente ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      if (objetoUrl.current) URL.revokeObjectURL(objetoUrl.current)
    }
  }, [])

  // Troca o preview por uma object URL local, revogando a anterior (se houver).
  function definirPreviewLocal(url: string | null) {
    if (objetoUrl.current) URL.revokeObjectURL(objetoUrl.current)
    objetoUrl.current = url
    setLogoPreview(url)
  }

  // Usuária escolheu um arquivo de logo: valida formato e tamanho, mostra preview.
  function aoEscolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!TIPOS_LOGO[f.type]) {
      avisar('A logo precisa ser PNG, JPG ou WebP.')
      return
    }
    if (f.size > LOGO_MAX_BYTES) {
      avisar('A logo está acima de 1 MB. Escolha uma imagem menor.')
      return
    }
    setLogoFile(f)
    setLogoRemover(false)
    definirPreviewLocal(URL.createObjectURL(f))
  }

  // Marca a logo para remoção (aplicada ao salvar).
  function removerLogo() {
    setLogoFile(null)
    setLogoRemover(true)
    definirPreviewLocal(null)
  }

  // Normaliza o @ enquanto digita: minúsculas, sem espaços, só caracteres válidos.
  function aoDigitarArroba(valor: string) {
    const limpo = valor.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    setArroba(limpo)
    if (limpo && !REGRA_ARROBA.test(limpo)) {
      setErroArroba('Use 3 a 30 letras/números (sem espaços nem acento).')
    } else {
      setErroArroba(null)
    }
  }

  async function salvar() {
    if (!sessao) return
    if (estaOffline()) return avisar(SEM_CONEXAO)
    if (!nomeNegocio.trim()) return avisar('Dê um nome ao seu negócio')
    if (!REGRA_ARROBA.test(arroba)) return avisar('Escolha um @ válido para o link')
    if (erroArroba) return

    setSalvando(true)

    // Verifica se o @ já é de outra pessoa (o banco também garante com unique).
    const { data: ocupado } = await supabase
      .from('perfis')
      .select('id')
      .eq('arroba', arroba)
      .neq('id', sessao.user.id)
      .maybeSingle()

    if (ocupado) {
      setSalvando(false)
      setErroArroba('Esse @ já está em uso. Tente outro.')
      return
    }

    // M-038 · Logo. Por padrão preserva a atual; sobe a nova OU marca a remoção.
    // Sem compressão — o arquivo original sobe como está (mantém transparência).
    // A logo NÃO entra em `trabalhos`, então não conta no limite de 150 (M-011).
    let logoPathFinal = logoPath
    let logoAntigaParaRemover: string | null = null
    if (logoFile) {
      const ext = TIPOS_LOGO[logoFile.type]
      const novoPath = `${sessao.user.id}/logo/logo.${ext}`
      const { error: upErro } = await supabase.storage
        .from(BUCKET_PUBLICO)
        .upload(novoPath, logoFile, { contentType: logoFile.type, upsert: true })
      if (upErro) {
        setSalvando(false)
        console.error('[Cabideia Encanto] Falha ao enviar a logo:', upErro.message)
        avisar('Não consegui enviar a logo. Tente de novo.')
        return
      }
      // Se a extensão mudou, o caminho antigo vira órfão — remove após salvar.
      if (logoPath && logoPath !== novoPath) logoAntigaParaRemover = logoPath
      logoPathFinal = novoPath
    } else if (logoRemover && logoPath) {
      logoAntigaParaRemover = logoPath
      logoPathFinal = null
    }

    // upsert: cria o perfil na primeira vez, atualiza nas próximas.
    const { error } = await supabase.from('perfis').upsert({
      id: sessao.user.id,
      nome_negocio: nomeNegocio.trim(),
      arroba,
      bio: bio.trim() || null,
      cidade: cidade.trim() || null,
      nicho,
      whatsapp: whatsapp.trim() || null,
      logo_path: logoPathFinal,
      atualizado_em: new Date().toISOString(),
    })

    if (error) {
      setSalvando(false)
      console.error('[Cabideia Encanto] Falha ao salvar perfil:', error.message)
      avisar('Não consegui salvar. Tente de novo.')
      return
    }

    // Perfil salvo: agora é seguro apagar o arquivo de logo antigo/removido.
    if (logoAntigaParaRemover) {
      await supabase.storage.from(BUCKET_PUBLICO).remove([logoAntigaParaRemover])
    }
    setLogoPath(logoPathFinal)
    setLogoFile(null)
    setLogoRemover(false)

    setSalvando(false)
    avisar('Perfil salvo ✓')
    onSalvo()
  }

  if (carregando) return null

  return (
    <>
      <p className="apoio" style={{ marginBottom: 16 }}>
        Esses dados montam sua vitrine pública e o link que você compartilha.
      </p>

      <div className="campo">
        <label>Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="logo-redonda" style={{ flexShrink: 0 }}>
            {logoPreview ? (
              <img
                src={logoPreview}
                alt=""
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : nomeNegocio.trim() ? (
              nomeNegocio.trim().charAt(0).toUpperCase()
            ) : (
              <Icone nome="brilho" size={22} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => inputLogo.current?.click()}
              disabled={salvando}
            >
              <Icone nome="imagem" size={16} /> {logoPreview ? 'Trocar logo' : 'Adicionar logo'}
            </button>
            {logoPreview && (
              <button
                type="button"
                className="btn-secundario"
                onClick={removerLogo}
                disabled={salvando}
              >
                <Icone nome="lixo" size={16} /> Remover logo
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputLogo}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={aoEscolherLogo}
        />
        <p className="apoio" style={{ marginTop: 6 }}>
          PNG, JPG ou WebP, até 1 MB. PNG com fundo transparente fica perfeito.
        </p>
      </div>

      <div className="campo">
        <label>Nome do negócio</label>
        <input
          value={nomeNegocio}
          onChange={(e) => setNomeNegocio(e.target.value)}
          placeholder="Ex.: Doces da Alessandra"
          maxLength={60}
        />
      </div>

      <div className="campo">
        <label>Seu @ (o link da vitrine)</label>
        <input
          value={arroba}
          onChange={(e) => aoDigitarArroba(e.target.value)}
          placeholder="ex.: alessandra"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="text"
        />
        <p className="apoio" style={{ marginTop: 6 }}>
          cabideia.com.br/encanto/@<b>{arroba || 'seu-nome'}</b>
        </p>
        {erroArroba && (
          <p className="apoio" style={{ marginTop: 4, color: 'var(--framboesa)' }}>
            {erroArroba}
          </p>
        )}
      </div>

      <div className="campo">
        <label>Nicho</label>
        <select value={nicho} onChange={(e) => setNicho(e.target.value)}>
          {NICHOS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label>Cidade</label>
        <input
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          placeholder="Ex.: Lençóis Paulista, SP"
          maxLength={60}
        />
      </div>

      <div className="campo">
        <label>WhatsApp (com DDD)</label>
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Ex.: (14) 99999-9999"
          inputMode="tel"
          maxLength={20}
        />
        <p className="apoio" style={{ marginTop: 6 }}>
          É o botão “Pedir pelo WhatsApp” que suas clientes vão tocar.
        </p>
      </div>

      <div className="campo">
        <label>Bio (uma frase sobre você)</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Ex.: Bolos e doces artesanais por encomenda, feitos com carinho."
          maxLength={160}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {onCancelar && (
          <button
            type="button"
            className="btn-secundario"
            style={{ flex: 1 }}
            onClick={onCancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="cta"
          style={{ flex: 2, height: 48 }}
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </>
  )
}
