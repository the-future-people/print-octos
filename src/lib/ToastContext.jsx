import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * A line that says what just happened.
 *
 * Pressing Continue and landing somewhere that looks the same gives a
 * customer no reason to believe anything worked. This is the smallest
 * thing that tells them — what went in, and that it will keep.
 *
 * It fades on its own. A message that needs dismissing is a second
 * thing to do about something that already succeeded.
 */

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const show = useCallback((title, detail) => {
    setToast({ title, detail, at: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    // Long enough to read two lines without hurrying.
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {toast && (
        <div
          role="status"
          className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:w-[360px]
                     z-50 rounded-xl bg-ink text-white shadow-lg
                     px-4 py-3.5 flex items-start gap-3
                     animate-[toast_240ms_ease-out]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
               className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400"
               aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
          </svg>

          <div className="min-w-0">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.detail && (
              <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                {toast.detail}
              </p>
            )}
          </div>

          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="ml-auto shrink-0 text-white/50 hover:text-white
                       transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return value
}