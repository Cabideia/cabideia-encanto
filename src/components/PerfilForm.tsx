import { useEffect, useState } from 'react'
import { useAviso } from './Toast'
import { useSessao } from '../hooks/useSessao'
import { supabase } from '../lib/supabase'
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

  // Carrega o perfil existente (se houver).
  useEffect(() => {
    if (!sessao) return
    supabase
      .from('perfis')
      .select('nome_negocio, arroba, bio, cidade, nicho, whatsapp')
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
        }
        setCarregando(false)
      })
  }, [sessao])

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

    // upsert: cria o perfil na primeira vez, atualiza nas próximas.
    const { error } = await supabase.from('perfis').upsert({
      id: sessao.user.id,
      nome_negocio: nomeNegocio.trim(),
      arroba,
      bio: bio.trim() || null,
      cidade: cidade.trim() || null,
      nicho,
      whatsapp: whatsapp.trim() || null,
      atualizado_em: new Date().toISOString(),
    })

    setSalvando(false)
    if (error) {
      console.error('[Cabideia Encanto] Falha ao salvar perfil:', error.message)
      avisar('Não consegui salvar. Tente de novo.')
      return
    }
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
