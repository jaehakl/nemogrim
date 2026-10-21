import { FiCompass } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { StatePanel } from '../components/ui/StatePanel'

export function NotFoundPage() {
  return (
    <StatePanel
      kind="empty"
      icon={<FiCompass aria-hidden="true" />}
      title="페이지를 찾을 수 없습니다"
      description="주소가 바뀌었거나 삭제된 페이지입니다."
      actions={<Link to="/movies" className="btn btn--primary">영상 라이브러리로 이동</Link>}
    />
  )
}
