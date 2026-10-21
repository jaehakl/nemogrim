import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FiMenu, FiSearch, FiX } from 'react-icons/fi'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { hasModifier, isEditableTarget } from '../../lib/keyboard'

interface TopBarProps {
  drawerOpen: boolean
  onOpenDrawer: () => void
}

export function TopBar({ drawerOpen, onOpenDrawer }: TopBarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button topbar__menu"
        aria-label="메뉴 열기"
        aria-controls="app-sidebar"
        aria-expanded={drawerOpen}
        onClick={onOpenDrawer}
      >
        <FiMenu aria-hidden="true" />
      </button>
      <GlobalSearch />
    </header>
  )
}

/** CLIP Scene 검색. 결과는 `/scenes?q=` 로 이동해 보여주고, `/` 키로 바로 입력할 수 있다. */
export function GlobalSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const activeQuery = location.pathname === '/scenes' ? searchParams.get('q') ?? '' : ''
  const [draft, setDraft] = useState(activeQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(activeQuery) }, [activeQuery])

  useEffect(() => {
    function focusOnSlash(event: KeyboardEvent) {
      if (event.key !== '/' || hasModifier(event) || isEditableTarget(event.target)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = draft.trim()
    setDraft(query)
    navigate(query ? `/scenes?${new URLSearchParams({ q: query })}` : '/scenes')
    inputRef.current?.blur()
  }

  function clear() {
    setDraft('')
    if (activeQuery) navigate('/scenes')
    inputRef.current?.focus()
  }

  return (
    <form className="global-search" role="search" onSubmit={submit}>
      <FiSearch className="global-search__icon" aria-hidden="true" />
      <label className="sr-only" htmlFor="global-search-input">Scene 검색</label>
      <input
        id="global-search-input"
        ref={inputRef}
        type="search"
        value={draft}
        maxLength={500}
        autoComplete="off"
        placeholder="장면 검색 — 예: girl walking on the beach at sunset"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (draft) setDraft('')
            else event.currentTarget.blur()
          }
        }}
      />
      {draft ? (
        <button type="button" className="icon-button global-search__clear" aria-label="검색어 지우기" onClick={clear}>
          <FiX aria-hidden="true" />
        </button>
      ) : (
        <kbd className="global-search__hint" aria-hidden="true">/</kbd>
      )}
      <button type="submit" className="sr-only">검색</button>
    </form>
  )
}
