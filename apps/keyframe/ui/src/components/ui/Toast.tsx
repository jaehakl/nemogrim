import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'
import type { Tone } from '../../lib/status'
import { ToastContext, type Notify, type ToastInput } from './toastContext'
import './ui.css'

interface ToastItem extends ToastInput {
  id: number
}

const ICONS: Record<Tone, ReactNode> = {
  neutral: <FiInfo aria-hidden="true" />,
  info: <FiInfo aria-hidden="true" />,
  success: <FiCheckCircle aria-hidden="true" />,
  warning: <FiAlertTriangle aria-hidden="true" />,
  danger: <FiAlertCircle aria-hidden="true" />,
}

const DURATION_MS: Record<Tone, number> = {
  neutral: 4000, info: 4000, success: 4000, warning: 7000, danger: 8000,
}

const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback<Notify>((toast) => {
    const id = ++nextId.current
    setToasts((current) => [...current.slice(1 - MAX_VISIBLE), { ...toast, id }])
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.tone])
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.id, toast.tone])

  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === 'danger' ? 'alert' : 'status'}>
      {ICONS[toast.tone]}
      <div className="toast__body">
        <strong>{toast.title}</strong>
        {toast.description ? <span title={toast.description}>{toast.description}</span> : null}
      </div>
      <button type="button" className="icon-button" aria-label="알림 닫기" onClick={() => onDismiss(toast.id)}>
        <FiX aria-hidden="true" />
      </button>
    </div>
  )
}
