import { createContext, useContext } from 'react'
import type { Tone } from '../../lib/status'

export interface ToastInput {
  tone: Tone
  title: string
  description?: string
}

export type Notify = (toast: ToastInput) => void

export const ToastContext = createContext<Notify | null>(null)

export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast는 ToastProvider 안에서만 사용할 수 있습니다')
  return notify
}
