import { FiBarChart2, FiFilm, FiGrid, FiHardDrive } from 'react-icons/fi'
import { NavLink, Outlet } from 'react-router-dom'
import './AppLayout.css'

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><FiFilm /></span>
          <span><strong>Keyframe</strong><small>Scene workspace</small></span>
        </div>

        <nav className="sidebar__nav" aria-label="주요 메뉴">
          <button type="button" className="nav-item" disabled>
            <FiGrid aria-hidden="true" /><span>Scene 탐색</span><small>준비 중</small>
          </button>
          <NavLink
            to="/movies"
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <FiFilm aria-hidden="true" /><span>영상 라이브러리</span>
          </NavLink>
          <button type="button" className="nav-item" disabled>
            <FiBarChart2 aria-hidden="true" /><span>통계</span><small>준비 중</small>
          </button>
        </nav>

        <div className="sidebar__footer">
          <FiHardDrive aria-hidden="true" />
          <span><strong>로컬 라이브러리</strong><small>원본 파일을 이동하지 않습니다</small></span>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  )
}
