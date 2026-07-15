import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SceneVideoPlayer, type SceneVideoPlayerHandle } from '../components/scene/SceneVideoPlayer'

describe('SceneVideoPlayer', () => {
  it('applies the start timestamp and reapplies it for the same stream URL', async () => {
    const onCreateScene = vi.fn()
    const view = render(
      <SceneVideoPlayer
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating={false}
        onCreateScene={onCreateScene}
        startAtMs={12_345}
        autoPlayStart
      />,
    )
    const player = document.querySelector('video') as HTMLVideoElement
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(player, 'play', { configurable: true, value: play })
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
    fireEvent.loadedMetadata(player)
    expect(player.currentTime).toBe(12.345)
    expect(play).toHaveBeenCalledOnce()

    view.rerender(
      <SceneVideoPlayer
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating={false}
        onCreateScene={onCreateScene}
        startAtMs={20_000}
        autoPlayStart
      />,
    )
    expect(player.currentTime).toBe(20)
    expect(screen.getByText('00:20.000')).toBeInTheDocument()
  })

  it('exposes playAt and optionally scrolls the shared player into view', () => {
    const ref = createRef<SceneVideoPlayerHandle>()
    render(
      <SceneVideoPlayer
        ref={ref}
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating={false}
        onCreateScene={vi.fn()}
      />,
    )
    const player = document.querySelector('video') as HTMLVideoElement
    const play = vi.fn().mockResolvedValue(undefined)
    const panel = screen.getByRole('region', { name: '영상 플레이어' })
    panel.scrollIntoView = vi.fn()
    Object.defineProperty(player, 'play', { configurable: true, value: play })
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })

    act(() => ref.current?.playAt(5_000, true))

    expect(player.currentTime).toBe(5)
    expect(play).toHaveBeenCalledOnce()
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('handles seek and Scene creation shortcuts while ignoring editable fields', async () => {
    const user = userEvent.setup()
    const onCreateScene = vi.fn()
    const view = render(
      <SceneVideoPlayer
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating={false}
        onCreateScene={onCreateScene}
      />,
    )
    const player = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
    player.currentTime = 100

    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    expect(player.currentTime).toBe(160)
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true, ctrlKey: true })
    expect(player.currentTime).toBe(460)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(player.currentTime).toBe(470)
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
    expect(player.currentTime).toBe(470)

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowLeft' })
    expect(player.currentTime).toBe(470)
    input.remove()

    player.currentTime = 12.345
    fireEvent.timeUpdate(player)
    await user.click(screen.getByRole('button', { name: '현재 위치에 Scene 생성' }))
    expect(onCreateScene).toHaveBeenLastCalledWith(12_345)
    fireEvent.keyDown(window, { key: 's' })
    expect(onCreateScene).toHaveBeenCalledTimes(2)

    view.rerender(
      <SceneVideoPlayer
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating
        onCreateScene={onCreateScene}
      />,
    )
    expect(screen.getByRole('button', { name: 'Scene 등록 중' })).toBeDisabled()
  })

  it('keeps the requested timestamp when autoplay is rejected', async () => {
    render(
      <SceneVideoPlayer
        streamUrl="/stream"
        durationMs={600_000}
        playbackError={null}
        creating={false}
        onCreateScene={vi.fn()}
        startAtMs={30_000}
        autoPlayStart
      />,
    )
    const player = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(player, 'play', {
      configurable: true,
      value: vi.fn().mockRejectedValueOnce(new Error('autoplay blocked')),
    })
    Object.defineProperty(player, 'duration', { configurable: true, value: 600 })
    fireEvent.loadedMetadata(player)
    await act(async () => { await Promise.resolve() })

    expect(player.currentTime).toBe(30)
    expect(screen.getByText('00:30.000')).toBeInTheDocument()
  })
})
