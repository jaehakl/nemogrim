import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { MovieLibraryPage } from './pages/movies/MovieLibraryPage'
import { MovieDetailPage } from './pages/movie-detail/MovieDetailPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/movies" replace />} />
        <Route path="movies" element={<MovieLibraryPage />} />
        <Route path="movies/:movieId" element={<MovieDetailPage />} />
        <Route path="*" element={<Navigate to="/movies" replace />} />
      </Route>
    </Routes>
  )
}
