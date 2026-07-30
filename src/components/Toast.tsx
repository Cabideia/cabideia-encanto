import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContexto = createContext<(mensagem: string) => void>(() => {})

/** Padrão do design system: toast único, confirmação de toda ação. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mensagem, setMensagem] = useState('')
  const [visivel, setVisivel] = useState(false)
  const cronometro = useRef<ReturnType<typeof setTimeout>>()

  const avisar = useCallback((m: string) => {
    setMensagem(m)
    setVisivel(true)
    clearTimeout(cronometro.current)
    // Mensagens longas ficam mais tempo na tela; as curtas (ex.: "Link copiado ✓")
    // mantêm o ritmo rápido de sempre.
    const ms = m.length > 60 ? 3000 : 1900
    cronometro.current = setTimeout(() => setVisivel(false), ms)
  }, [])

  return (
    <ToastContexto.Provider value={avisar}>
      {children}
      <div id="toast" className={visivel ? 'mostra' : ''} role="status">
        {mensagem}
      </div>
    </ToastContexto.Provider>
  )
}

export function useAviso() {
  return useContext(ToastContexto)
}
