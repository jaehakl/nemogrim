import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiFilm, FiFolder, FiLoader, FiPlus } from 'react-icons/fi'
import './AddMovieMenu.css'

export type ImportMode = 'files' | 'folder'

interface AddMovieMenuProps {
  importing: ImportMode | null
  onImport: (mode: ImportMode) => void
}

export function AddMovieMenu({ importing, onImport }: AddMovieMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeMenu(event: Event) {
      if (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') {
        setOpen(false)
      } else if (event.type === 'pointerdown' && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [])

  function select(mode: ImportMode) {
    setOpen(false)
    onImport(mode)
  }

  return (
    <div className="add-menu" ref={menuRef}>
      <button type="button" className="primary-button" aria-haspopup="menu" aria-expanded={open}
        disabled={Boolean(importing)} onClick={() => setOpen((current) => !current)}>
        {importing ? <FiLoader className="button-spinner" /> : <FiPlus />}
        {importing ? '탐색기에서 선택 중' : '영상 추가'}
        {!importing ? <FiChevronDown /> : null}
      </button>
      {open ? (
        <div className="add-menu__popover" role="menu">
          <button type="button" role="menuitem" onClick={() => select('files')}>
            <FiFilm aria-hidden="true" /><span><strong>파일 선택</strong><small>여러 영상 파일을 한 번에 추가</small></span>
          </button>
          <button type="button" role="menuitem" onClick={() => select('folder')}>
            <FiFolder aria-hidden="true" /><span><strong>폴더 선택</strong><small>하위 폴더의 영상까지 모두 검색</small></span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
