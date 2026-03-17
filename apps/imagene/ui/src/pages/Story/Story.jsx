import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, getStoryImages } from '../../api/api';
import './Story.css';

const AUTOPLAY_INTERVAL_MS = 1400;

export const Story = () => {
  const containerRef = useRef(null);
  const autoplayTimerRef = useRef(null);

  const [previousImage, setPreviousImage] = useState(null);
  const [candidateImages, setCandidateImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nextPlaybackImage = useMemo(() => {
    return candidateImages[1] || candidateImages[0] || null;
  }, [candidateImages]);

  const getImageFrameStyle = (image) => {
    if (!image?.width || !image?.height) {
      return undefined;
    }

    return {
      aspectRatio: `${image.width} / ${image.height}`,
    };
  };

  const stopPlayback = async ({ exitFullscreen = false } = {}) => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }

    setIsPlaybackMode(false);

    if (exitFullscreen && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (fullscreenError) {
        // Ignore fullscreen exit errors and keep the page usable.
      }
    }
  };

  const loadStoryImages = async (imageId = null, imageIdPrev = null) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await getStoryImages(imageId, imageIdPrev);
      const [sourceImage, ...candidates] = response.data || [];

      setPreviousImage(sourceImage || null);
      setCandidateImages(candidates);

      if (!sourceImage) {
        setError('No story image was returned.');
      }

      return {
        sourceImage: sourceImage || null,
        candidates,
      };
    } catch (requestError) {
      setPreviousImage(null);
      setCandidateImages([]);
      setError('Failed to load story images.');

      return {
        sourceImage: null,
        candidates: [],
      };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStoryImages();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenActive = document.fullscreenElement === containerRef.current;
      setIsFullscreen(fullscreenActive);

      if (!fullscreenActive && isPlaybackMode) {
        stopPlayback();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isPlaybackMode]);

  useEffect(() => {
    if (!isPlaybackMode || isLoading) {
      return undefined;
    }

    if (!previousImage || !nextPlaybackImage) {
      stopPlayback();
      return undefined;
    }

    autoplayTimerRef.current = setTimeout(async () => {
      autoplayTimerRef.current = null;
      await loadStoryImages(nextPlaybackImage.id);
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [isLoading, isPlaybackMode, nextPlaybackImage, previousImage]);

  useEffect(() => () => {
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current);
    }
  }, []);

  const handleCandidateClick = (selectedImage) => {
    if (!previousImage || isLoading || isPlaybackMode) {
      return;
    }

    loadStoryImages(selectedImage.id, previousImage.id);
  };

  const handleReset = async () => {
    await stopPlayback({ exitFullscreen: true });
    await loadStoryImages();
  };

  const handleStartPlayback = async () => {
    if (!previousImage || !nextPlaybackImage || isLoading) {
      return;
    }

    setError('');
    setIsPlaybackMode(true);

    if (containerRef.current && document.fullscreenElement !== containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (fullscreenError) {
        setError('Fullscreen mode could not be started.');
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`story-page${isPlaybackMode ? ' playback-mode' : ''}${isFullscreen ? ' fullscreen' : ''}`}
    >
      <div className="story-page-header">
        <div>
          <h2>Story</h2>
          <p>
            Click one of the four candidates to continue, or switch to playback mode to keep
            selecting the second candidate automatically.
          </p>
        </div>
        <div className="story-header-actions">
          <button
            type="button"
            className="story-reset-button"
            onClick={handleReset}
            disabled={isLoading}
          >
            Reset
          </button>
          {isPlaybackMode ? (
            <button
              type="button"
              className="story-playback-button stop"
              onClick={() => stopPlayback({ exitFullscreen: true })}
            >
              Stop Playback
            </button>
          ) : (
            <button
              type="button"
              className="story-playback-button"
              onClick={handleStartPlayback}
              disabled={isLoading || !nextPlaybackImage}
            >
              Playback Mode
            </button>
          )}
        </div>
      </div>

      {error ? <div className="story-status-message error">{error}</div> : null}
      {isLoading ? <div className="story-status-message">Loading story images.</div> : null}

      {!isLoading && previousImage ? (
        <div className={`story-layout${isPlaybackMode ? ' playback-layout' : ''}`}>
          <section className="story-current-section">
            <div className="story-section-header">
              <h3>{isPlaybackMode ? 'Current Image' : 'Previous Image'}</h3>
              <span>ID {previousImage.id}</span>
            </div>
            <div className="story-current-card" style={getImageFrameStyle(previousImage)}>
              <img
                src={`${API_URL}/${previousImage.url}`}
                alt={previousImage.title || String(previousImage.id)}
              />
            </div>
          </section>

          <section className="story-candidates-section">
            <div className="story-section-header">
              <h3>{isPlaybackMode ? 'Next Image' : 'Next Image Candidates'}</h3>
              <span>{isPlaybackMode ? 'Item 2 auto-selected' : `${candidateImages.length} items`}</span>
            </div>

            {isPlaybackMode ? (
              nextPlaybackImage ? (
                <div
                  className="story-playback-next-card"
                  style={getImageFrameStyle(nextPlaybackImage)}
                >
                  <img
                    src={`${API_URL}/${nextPlaybackImage.url}`}
                    alt={nextPlaybackImage.title || String(nextPlaybackImage.id)}
                  />
                  <div className="story-playback-overlay">
                    <strong>{nextPlaybackImage.title || `Image ${nextPlaybackImage.id}`}</strong>
                    <span>ID {nextPlaybackImage.id}</span>
                  </div>
                </div>
              ) : (
                <div className="story-status-message">No next image is available for playback.</div>
              )
            ) : candidateImages.length > 0 ? (
              <div className="story-candidates-grid">
                {candidateImages.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    className="story-candidate-card"
                    onClick={() => handleCandidateClick(image)}
                    disabled={isLoading}
                  >
                    <img
                      src={`${API_URL}/${image.url}`}
                      alt={image.title || String(image.id)}
                    />
                    <div className="story-candidate-meta">
                      <strong>{image.title || `Image ${image.id}`}</strong>
                      <span>ID {image.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="story-status-message">No candidate images are available.</div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
};
