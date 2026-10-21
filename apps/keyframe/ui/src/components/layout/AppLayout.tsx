import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import './layout.css'

const COLLAPSED_STORAGE_KEY = 'keyframe.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // 저장소를 쓸 수 없으면 이번 세션에서만 유지한다.
      }
      return next
    })
  }, [])

  // 모바일 drawer는 페이지를 이동하면 닫는다.
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [drawerOpen])

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}${drawerOpen ? ' app-shell--drawer-open' : ''}`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      {drawerOpen ? (
        <button type="button" className="app-shell__scrim" aria-label="메뉴 닫기" onClick={() => setDrawerOpen(false)} />
      ) : null}
      <div className="app-shell__main">
        <TopBar drawerOpen={drawerOpen} onOpenDrawer={() => setDrawerOpen(true)} />
        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
