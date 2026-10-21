import type { ReactNode } from 'react'
import { FiAlertCircle } from 'react-icons/fi'
import { Spinner } from './Spinner'
import './ui.css'

interface StatePanelProps {
  kind: 'loading' | 'empty' | 'error'
  title: string
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

/** 로딩, 빈 목록, 오류 상태를 같은 모양으로 보여준다. */
export function StatePanel({ kind, title, description, icon, actions, compact = false }: StatePanelProps) {
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined
  const visual = kind === 'loading' ? <Spinner /> : kind === 'error' ? <FiAlertCircle aria-hidden="true" /> : icon
  return (
    <div className={`state-panel state-panel--${kind}${compact ? ' state-panel--compact' : ''}`} role={role}>
      {visual ? <span className="state-panel__icon">{visual}</span> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="state-panel__actions">{actions}</div> : null}
    </div>
  )
}
