import { FiAlertCircle, FiClock, FiImage, FiLoader } from 'react-icons/fi'
import type { MetadataStatus, Movie } from '../../api/movies'
import { Link } from 'react-router-dom'
import { formatBytes, formatDate, formatDuration } from './formatters'
import './MovieCard.css'

const PROCESSING_STATUSES = new Set<MetadataStatus>(['pending', 'processing'])
const statusText: Record<MetadataStatus, string> = {
  pending: '대기 중', processing: '미리보기 생성 중', ready: '준비 완료', failed: '미리보기 실패',
}

export function MovieCard({ movie, to }: { movie: Movie; to?: string }) {
  const isWorking = PROCESSING_STATUSES.has(movie.metadata_status)
  const extension = movie.ext?.replace('.', '').toUpperCase() || 'VIDEO'

  return (
    <Link className="movie-card-link" to={to || `/movies/${movie.id}`} aria-label={`${movie.title} 상세 보기`}>
    <article className="movie-card">
      <div className="movie-card__preview">
        {movie.thumbnail_url ? (
          <img src={movie.thumbnail_url} alt={`${movie.title} 미리보기`} loading="lazy" />
        ) : (
          <div className={`preview-placeholder preview-placeholder--${movie.metadata_status}`}>
            {isWorking ? <FiLoader className="preview-placeholder__spinner" aria-hidden="true" />
              : movie.metadata_status === 'failed' ? <FiAlertCircle aria-hidden="true" />
                : <FiImage aria-hidden="true" />}
            <span>{statusText[movie.metadata_status]}</span>
          </div>
        )}
        <span className="movie-card__extension">{extension}</span>
        <span className="movie-card__duration"><FiClock aria-hidden="true" />{formatDuration(movie.duration_ms)}</span>
      </div>

      <div className="movie-card__body">
        <div className="movie-card__heading">
          <h2 title={movie.title}>{movie.title}</h2>
          <span className={`status-dot status-dot--${movie.metadata_status}`}>{statusText[movie.metadata_status]}</span>
        </div>
        <p className="movie-card__path" title={movie.path}>{movie.path}</p>
        {movie.metadata_status === 'failed' && movie.metadata_error ? (
          <p className="movie-card__error" title={movie.metadata_error}>{movie.metadata_error}</p>
        ) : null}
        <dl className="movie-card__meta">
          <div><dt>파일 크기</dt><dd>{formatBytes(movie.size_bytes)}</dd></div>
          <div><dt>수정일</dt><dd>{formatDate(movie.file_modified_at)}</dd></div>
          <div><dt>화면</dt><dd>{movie.width && movie.height ? `${movie.width} × ${movie.height}` : '분석 중'}</dd></div>
        </dl>
      </div>
    </article>
    </Link>
  )
}
