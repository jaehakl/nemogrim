import type { Tone } from '../../lib/status'
import { Spinner } from './Spinner'
import './ui.css'

interface StatusBadgeProps {
  tone: Tone
  label: string
  busy?: boolean
  title?: string
}

export function StatusBadge({ tone, label, busy = false, title }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`} title={title}>
      {busy ? <Spinner /> : <span className="status-badge__dot" aria-hidden="true" />}
      {label}
    </span>
  )
}
