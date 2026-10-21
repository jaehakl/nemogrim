import { FiLoader } from 'react-icons/fi'

export function Spinner({ className = '' }: { className?: string }) {
  return <FiLoader className={`spin ${className}`.trim()} aria-hidden="true" />
}
