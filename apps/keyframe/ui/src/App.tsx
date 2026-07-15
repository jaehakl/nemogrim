import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { MovieLibraryPage } from './pages/movies/MovieLibraryPage'
import { MovieDetailPage } from './pages/movie-detail/MovieDetailPage'
import { SceneDetailPage } from './pages/scene-detail/SceneDetailPage'
import { SceneExplorerPage } from './pages/scenes/SceneExplorerPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/movies" replace />} />
        <Route path="scenes" element={<SceneExplorerPage />} />
        <Route path="scenes/:sceneId" element={<SceneDetailPage />} />
        <Route path="movies" element={<MovieLibraryPage />} />
        <Route path="movies/:movieId" element={<MovieDetailPage />} />
        <Route path="*" element={<Navigate to="/movies" replace />} />
      </Route>
    </Routes>
  )
}
