import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' }
type ToastApi = {
  notify: (message: string, tone?: Toast['tone']) => void
  success: (message: string) => void
  error: (message: string) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++seq.current
    setToasts((list) => [...list, { id, message, tone }])
    const timer = setTimeout(() => { setToasts(list => list.filter(t => t.id !== id)); timers.current.delete(timer) }, 4200)
    timers.current.add(timer)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      success: (m) => notify(m, 'success'),
      error: (m) => notify(m, 'error'),
    }),
    [notify],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="rg-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rg-toast ${t.tone}`}>
            <span aria-hidden="true">{t.tone === 'success' ? '✓' : t.tone === 'error' ? '!' : '•'}</span>
            <p>{t.message}</p>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
