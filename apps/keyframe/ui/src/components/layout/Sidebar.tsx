import { FiChevronsLeft, FiChevronsRight, FiFilm, FiGrid } from 'react-icons/fi'
import { NavLink } from 'react-router-dom'
import { AiStatusIndicator } from './AiStatusIndicator'

const NAV_ITEMS = [
  { to: '/scenes', label: 'Scene 탐색', icon: FiGrid },
  { to: '/movies', label: '영상 라이브러리', icon: FiFilm },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside className="sidebar" id="app-sidebar" aria-label="사이드바">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true"><FiFilm /></span>
        <span className="sidebar__label">
          <strong>Keyframe</strong>
          <small>Scene workspace</small>
        </span>
      </div>

      <nav className="sidebar__nav" aria-label="주요 메뉴">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <Icon aria-hidden="true" />
            <span className="sidebar__label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <AiStatusIndicator compact={collapsed} />
        <button
          type="button"
          className="sidebar__collapse"
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <FiChevronsRight aria-hidden="true" /> : <FiChevronsLeft aria-hidden="true" />}
          <span className="sidebar__label">접기</span>
        </button>
      </div>
    </aside>
  )
}
