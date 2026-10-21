import { FiAlertCircle, FiFilm } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import type { Movie } from '../../api/types'
import { formatDuration, formatResolution } from '../../lib/format'
import { isWorking, JOB_TONE, METADATA_STATUS_LABEL } from '../../lib/status'
import { Spinner } from '../ui/Spinner'
import { StatusBadge } from '../ui/StatusBadge'
import './media.css'

export function MovieCard({ movie }: { movie: Movie }) {
  const working = isWorking(movie.metadata_status)
  const duration = formatDuration(movie.duration_ms)
  const resolution = formatResolution(movie.width, movie.height)
  const extension = movie.ext.replace('.', '').toUpperCase() || 'VIDEO'

  return (
    <Link className="media-card" to={`/movies/${movie.id}`} aria-label={`${movie.title} 상세 보기`}>
      <div className="media-card__poster">
        {movie.thumbnail_url ? (
          <img src={movie.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="media-card__placeholder">
            {working ? <Spinner /> : movie.metadata_status === 'failed' ? <FiAlertCircle aria-hidden="true" /> : <FiFilm aria-hidden="true" />}
          </div>
        )}
        <span className="media-card__badge media-card__badge--start">{extension}</span>
        {duration ? <span className="media-card__badge media-card__badge--end">{duration}</span> : null}
      </div>
      <div className="media-card__body">
        <h2 className="media-card__title" title={movie.title}>{movie.title}</h2>
        <div className="media-card__meta">
          {movie.metadata_status === 'ready' ? (
            <span>{resolution ?? '해상도 정보 없음'}</span>
          ) : (
            <StatusBadge
              tone={JOB_TONE[movie.metadata_status]}
              label={METADATA_STATUS_LABEL[movie.metadata_status]}
              busy={working}
              title={movie.metadata_error ?? undefined}
            />
          )}
        </div>
      </div>
    </Link>
  )
}
