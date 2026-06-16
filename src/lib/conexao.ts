import { useEffect, useState } from 'react'

/**
 * M-023 · Leitura offline + aviso explícito.
 *
 * Regra do produto: offline a usuária *vê* a última versão salva das telas,
 * mas criar/editar/excluir exige internet (a escrita NÃO é enfileirada — isso
 * é F2). Este módulo centraliza a detecção de conexão e a mensagem única.
 */

/** Mensagem única para qualquer ação de escrita tentada sem internet. */
export const SEM_CONEXAO = 'Esta ação precisa de internet.'

/**
 * True só quando o navegador tem certeza de que está offline.
 * Conservador de propósito: na dúvida (navigator ausente) deixa passar, para
 * nunca bloquear uma escrita por engano.
 */
export function estaOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Acompanha o estado de conexão via navigator.onLine + eventos online/offline.
 * Usado pelo banner global; some sozinho quando a internet volta.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  useEffect(() => {
    const subir = () => setOnline(true)
    const cair = () => setOnline(false)
    window.addEventListener('online', subir)
    window.addEventListener('offline', cair)
    return () => {
      window.removeEventListener('online', subir)
      window.removeEventListener('offline', cair)
    }
  }, [])
  return online
}
