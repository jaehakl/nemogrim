import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FiAlertCircle, FiCamera } from 'react-icons/fi'
import { formatTimestamp } from '../../lib/format'
import { hasModifier, isEditableTarget } from '../../lib/keyboard'
import { Spinner } from '../ui/Spinner'
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

const CREATE_SHORTCUT = 's'

/** 영상 길이 안으로 제한한 재생 위치(초). 메타데이터를 읽기 전에는 서버가 알려준 길이를 쓴다. */
function clampSeconds(player: HTMLVideoElement, durationMs: number | null, seconds: number): number {
  const fallback = durationMs ? durationMs / 1000 : Number.MAX_SAFE_INTEGER
  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : fallback
  return Math.min(Math.max(seconds, 0), duration)
}

function seekStepSeconds(event: KeyboardEvent): number {
  if (event.shiftKey) return 300
  if (event.ctrlKey) return 60
  return 10
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

    const seekTo = useCallback((player: HTMLVideoElement, seconds: number) => {
      player.currentTime = clampSeconds(player, durationMs, seconds)
      setCurrentTimeMs(Math.round(player.currentTime * 1000))
    }, [durationMs])

    const playAt = useCallback((timestampMs: number, shouldPlay: boolean, shouldScroll: boolean) => {
      const player = playerRef.current
      if (!player) return
      seekTo(player, timestampMs / 1000)
      if (shouldPlay) void player.play().catch(() => undefined)
      if (shouldScroll) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [seekTo])

    useImperativeHandle(ref, () => ({
      playAt: (timestampMs, shouldScroll = false) => playAt(timestampMs, true, shouldScroll),
    }), [playAt])

    useEffect(() => {
      if (startAtMs === undefined) {
        setCurrentTimeMs(0)
        return
      }
      setCurrentTimeMs(startAtMs)
      const player = playerRef.current
      if (player && (player.readyState >= 1 || metadataStreamRef.current === streamUrl)) {
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
        if (isEditableTarget(event.target)) return
        const player = playerRef.current
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && player) {
          event.preventDefault()
          if (event.repeat) return
          const direction = event.key === 'ArrowRight' ? 1 : -1
          seekTo(player, player.currentTime + direction * seekStepSeconds(event))
        } else if (event.key.toLowerCase() === CREATE_SHORTCUT && !hasModifier(event) && !event.repeat) {
          event.preventDefault()
          createAtCurrentTime()
        }
      }
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [createAtCurrentTime, seekTo])

    return (
      <section ref={panelRef} className="player" aria-label="영상 플레이어">
        <div className="player__frame">
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
            <div className="player__unavailable" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <strong>브라우저에서 직접 재생할 수 없는 영상입니다</strong>
              <span>{playbackError || '지원하는 파일과 codec의 영상만 직접 재생할 수 있습니다.'}</span>
            </div>
          )}
        </div>
        <div className="player__toolbar">
          <div className="player__position">
            <span>현재 위치</span>
            <strong>{formatTimestamp(currentTimeMs)}</strong>
          </div>
          <p className="player__shortcuts">
            <kbd>←</kbd><kbd>→</kbd> 10초 · <kbd>Ctrl</kbd> 1분 · <kbd>Shift</kbd> 5분 · <kbd>S</kbd> Scene 생성
          </p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!streamUrl || creating}
            onClick={createAtCurrentTime}
          >
            {creating ? <Spinner /> : <FiCamera aria-hidden="true" />}
            {creating ? 'Scene 등록 중' : '현재 위치에 Scene 생성'}
          </button>
        </div>
      </section>
    )
  },
)
