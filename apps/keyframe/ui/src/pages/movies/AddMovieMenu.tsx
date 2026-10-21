import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiFilm, FiFolder, FiPlus } from 'react-icons/fi'
import type { ImportMode } from '../../api/movies'
import { Spinner } from '../../components/ui/Spinner'
import './AddMovieMenu.css'

interface AddMovieMenuProps {
  importing: ImportMode | null
  onImport: (mode: ImportMode) => void
}

export function AddMovieMenu({ importing, onImport }: AddMovieMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: Event) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  function select(mode: ImportMode) {
    setOpen(false)
    onImport(mode)
  }

  return (
    <div className="add-menu" ref={menuRef}>
      <button
        type="button"
        className="btn btn--primary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={importing !== null}
        onClick={() => setOpen((current) => !current)}
      >
        {importing ? <Spinner /> : <FiPlus aria-hidden="true" />}
        {importing ? '탐색기에서 선택 중' : '영상 추가'}
        {importing ? null : <FiChevronDown aria-hidden="true" />}
      </button>
      {open ? (
        <div className="add-menu__popover" role="menu">
          <button type="button" role="menuitem" onClick={() => select('files')}>
            <FiFilm aria-hidden="true" />
            <span><strong>파일 선택</strong><small>여러 영상 파일을 한 번에 추가</small></span>
          </button>
          <button type="button" role="menuitem" onClick={() => select('folder')}>
            <FiFolder aria-hidden="true" />
            <span><strong>폴더 선택</strong><small>하위 폴더의 영상까지 모두 검색</small></span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
