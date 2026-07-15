import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FiAlertCircle, FiCamera, FiLoader } from 'react-icons/fi'
import { formatSceneTimestamp } from '../../pages/movie-detail/formatters'
import './SceneVideoPlayer.css'

export interface SceneVideoPlayerHandle {
  playAt: (timestampMs: number, scrollIntoView?: boolean) => void
}

interface SceneVideoPlayerProps {
  streamUrl: string | null
  durationMs: number | null
  playbackError: string | null
  creating: boolean
  onCreateScene: (timestampMs: number) => void
  startAtMs?: number
  autoPlayStart?: boolean
}

function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export const SceneVideoPlayer = forwardRef<SceneVideoPlayerHandle, SceneVideoPlayerProps>(
  function SceneVideoPlayer(
    { streamUrl, durationMs, playbackError, creating, onCreateScene, startAtMs, autoPlayStart = false },
    ref,
  ) {
    const playerRef = useRef<HTMLVideoElement>(null)
    const panelRef = useRef<HTMLElement>(null)
    const metadataStreamRef = useRef<string | null>(null)
    const [currentTimeMs, setCurrentTimeMs] = useState(startAtMs ?? 0)

    const playAt = useCallback((timestampMs: number, shouldPlay: boolean, shouldScroll: boolean) => {
      const player = playerRef.current
      if (!player) return
      const requestedSeconds = Math.max(0, timestampMs / 1000)
      const fallbackDuration = durationMs ? durationMs / 1000 : Number.MAX_SAFE_INTEGER
      const duration = Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : fallbackDuration
      player.currentTime = Math.min(requestedSeconds, duration)
      setCurrentTimeMs(Math.round(player.currentTime * 1000))
      if (shouldPlay) void player.play().catch(() => undefined)
      if (shouldScroll) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [durationMs])

    useImperativeHandle(ref, () => ({
      playAt: (timestampMs, shouldScroll = false) => playAt(timestampMs, true, shouldScroll),
    }), [playAt])

    useEffect(() => {
      if (startAtMs === undefined) {
        setCurrentTimeMs(0)
        return
      }
      setCurrentTimeMs(startAtMs)
      if (
        playerRef.current
        && (playerRef.current.readyState >= 1 || metadataStreamRef.current === streamUrl)
      ) {
        playAt(startAtMs, autoPlayStart, false)
      }
    }, [autoPlayStart, playAt, startAtMs, streamUrl])

    const createAtCurrentTime = useCallback(() => {
      const player = playerRef.current
      if (!player || !streamUrl || creating) return
      onCreateScene(Math.max(0, Math.round(player.currentTime * 1000)))
    }, [creating, onCreateScene, streamUrl])

    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (editableTarget(event.target)) return
        const player = playerRef.current
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && player) {
          event.preventDefault()
          if (event.repeat) return
          const step = event.shiftKey ? 300 : event.ctrlKey ? 60 : 10
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const fallbackDuration = durationMs ? durationMs / 1000 : Number.MAX_SAFE_INTEGER
          const duration = Number.isFinite(player.duration) && player.duration > 0
            ? player.duration
            : fallbackDuration
          player.currentTime = Math.min(Math.max(player.currentTime + direction * step, 0), duration)
          setCurrentTimeMs(Math.round(player.currentTime * 1000))
        } else if (
          event.key.toLowerCase() === 's'
          && !event.ctrlKey
          && !event.metaKey
          && !event.altKey
          && !event.repeat
        ) {
          event.preventDefault()
          createAtCurrentTime()
        }
      }
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [createAtCurrentTime, durationMs])

    return (
      <section ref={panelRef} className="scene-video-player" aria-label="영상 플레이어">
        <div className="scene-video-player__frame">
          {streamUrl ? (
            <video
              key={streamUrl}
              ref={playerRef}
              controls
              preload="metadata"
              src={streamUrl}
              onLoadedMetadata={() => {
                metadataStreamRef.current = streamUrl
                if (startAtMs !== undefined) playAt(startAtMs, autoPlayStart, false)
              }}
              onTimeUpdate={(event) => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
            >이 브라우저는 영상 재생을 지원하지 않습니다.</video>
          ) : (
            <div className="scene-video-player__state scene-video-player__state--error" role="alert">
              <FiAlertCircle />
              <strong>브라우저에서 직접 재생할 수 없는 영상입니다</strong>
              <span>{playbackError || '지원하는 파일과 codec의 영상만 직접 재생할 수 있습니다.'}</span>
            </div>
          )}
        </div>
        <div className="scene-video-player__toolbar">
          <div><span>현재 위치</span><strong>{formatSceneTimestamp(currentTimeMs)}</strong></div>
          <button type="button" className="primary-button" disabled={!streamUrl || creating} onClick={createAtCurrentTime}>
            {creating ? <FiLoader className="button-spinner" aria-hidden="true" /> : <FiCamera aria-hidden="true" />}
            {creating ? 'Scene 등록 중' : '현재 위치에 Scene 생성'}
          </button>
        </div>
        <p className="scene-video-player__shortcuts"><kbd>←</kbd><kbd>→</kbd> 10초 · <kbd>Ctrl</kbd> 1분 · <kbd>Shift</kbd> 5분 · <kbd>S</kbd> Scene 생성</p>
      </section>
    )
  },
)
