import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * M-020 · Etapa 1 — Página pública de uma seleção (cabideia.com.br/encanto/s/:token).
 *
 * Sem login. Mostra as fotos que a boleira escolheu para uma cliente específica.
 * A RLS garante que só seleções não expiradas retornam — e que apenas os
 * trabalhos dessa seleção ficam visíveis (mesmo os que não estão na vitrine).
 */
type DadosSelecao = {
  titulo: string | null
  mensagem: string | null
  negocio: string | null
  whatsapp: string | null
  fotos: { id: string; url: string; descricao: string | null }[]
}

export function SelecaoPublica() {
  const { token } = useParams()
  const [dados, setDados] = useState<DadosSelecao | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalida'>('carregando')

  useEffect(() => {
    if (!token) {
      setEstado('invalida')
      return
    }
    async function carregar() {
      // Seleção (RLS já filtra expiradas)
      const { data: sel } = await supabase
        .from('selecoes')
        .select('id, titulo, mensagem, usuaria_id')
        .eq('token', token)
        .maybeSingle()

      if (!sel) {
        setEstado('invalida')
        return
      }

      // Itens + fotos
      const { data: itens } = await supabase
        .from('selecao_itens')
        .select('ordem, trabalhos(id, foto_publica_path, foto_path, descricao)')
        .eq('selecao_id', (sel as any).id)
        .order('ordem', { ascending: true })

      // Dados do negócio (nome + whatsapp) para o botão de contato
      const { data: perfil } = await supabase
        .from('perfis')
        .select('nome_negocio, whatsapp')
        .eq('id', (sel as any).usuaria_id)
        .maybeSingle()

      const fotos = (itens ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => it.trabalhos)
        .filter((t: any) => t && (t.foto_publica_path || t.foto_path))
        .map((t: any) => ({
          id: t.id,
          descricao: t.descricao,
          url: supabase.storage
            .from('publico')
            .getPublicUrl((t.foto_publica_path ?? t.foto_path) as string).data.publicUrl,
        }))

      setDados({
        titulo: (sel as any).titulo,
        mensagem: (sel as any).mensagem,
        negocio: perfil?.nome_negocio ?? null,
        whatsapp: perfil?.whatsapp ?? null,
        fotos,
      })
      setEstado('ok')
    }
    carregar()
  }, [token])

  function abrirWhatsApp() {
    if (!dados?.whatsapp) return
    let num = dados.whatsapp.replace(/\D/g, '')
    if (num.length <= 11) num = '55' + num
    const texto = encodeURIComponent('Olá! Vi a seleção que você me enviou e gostaria de conversar 💕')
    window.open(`https://wa.me/${num}?text=${texto}`, '_blank')
  }

  if (estado === 'carregando') {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <p className="apoio">Carregando…</p>
        </div>
      </div>
    )
  }

  if (estado === 'invalida' || !dados) {
    return (
      <div className="tela">
        <div className="conteudo" style={{ paddingTop: 40, textAlign: 'center' }}>
          <div className="logo-redonda" style={{ margin: '0 auto 16px' }}>✨</div>
          <div className="nome-negocio">Seleção indisponível</div>
          <p className="apoio" style={{ marginTop: 8 }}>
            Este link expirou ou não existe mais. Peça um novo à pessoa que te enviou.
          </p>
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tela">
      <div className="conteudo" style={{ paddingTop: 16 }}>
        <div className="vitrine-moldura">
          <div className="babado" />
          <div className="vitrine-corpo">
            <div className="logo-redonda">✨</div>
            <div className="nome-negocio">{dados.titulo || 'Seleção especial pra você'}</div>
            {dados.negocio && <div className="apoio">por {dados.negocio}</div>}
            {dados.mensagem && (
              <p className="apoio" style={{ marginTop: 8, textAlign: 'center' }}>
                {dados.mensagem}
              </p>
            )}
          </div>
        </div>

        {dados.fotos.length > 0 ? (
          <div className="grade-fotos" style={{ marginTop: 16 }}>
            {dados.fotos.map((f) => (
              <div key={f.id} className="foto-item">
                <img src={f.url} alt={f.descricao ?? ''} loading="lazy" />
                {f.descricao && <div className="foto-legenda">{f.descricao}</div>}
              </div>
            ))}
          </div>
        ) : (
          <p className="apoio" style={{ textAlign: 'center', marginTop: 24 }}>
            Esta seleção está sem fotos.
          </p>
        )}

        <p className="apoio" style={{ textAlign: 'center', marginTop: 16 }}>
          feito com <b style={{ color: 'var(--framboesa)' }}>Cabideia Encanto</b> ✨
        </p>
      </div>

      {dados.whatsapp && (
        <div className="cta-area">
          <button className="cta" onClick={abrirWhatsApp}>
            💬 Falar no WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}
