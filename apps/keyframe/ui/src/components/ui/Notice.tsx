import type { ReactNode } from 'react'
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'
import type { Tone } from '../../lib/status'
import './ui.css'

const ICONS: Record<Tone, ReactNode> = {
  neutral: <FiInfo aria-hidden="true" />,
  info: <FiInfo aria-hidden="true" />,
  success: <FiCheckCircle aria-hidden="true" />,
  warning: <FiAlertTriangle aria-hidden="true" />,
  danger: <FiAlertCircle aria-hidden="true" />,
}

interface NoticeProps {
  tone: Tone
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
}

/** 페이지 안에 머무는 안내 메시지. 잠깐 보여줄 결과는 Toast를 쓴다. */
export function Notice({ tone, title, description, action, onDismiss }: NoticeProps) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {ICONS[tone]}
      <div className="notice__body">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {action}
      {onDismiss ? (
        <button type="button" className="icon-button" aria-label="알림 닫기" onClick={onDismiss}>
          <FiX aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
