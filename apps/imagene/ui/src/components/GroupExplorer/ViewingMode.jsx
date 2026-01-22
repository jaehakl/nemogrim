import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../../api/api';
import './ViewingMode.css';

// 배열 셔플 함수 (Fisher-Yates)
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const ViewingMode = ({ 
  images, 
  onClose, 
  refreshDirectory 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayImages, setDisplayImages] = useState([]);
  const [intervalTime, setIntervalTime] = useState(5); // 초 단위
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const MAX_IMAGES = 15;

  // 이미지 준비 함수
  const prepareImages = useCallback(() => {
    if (!images || images.length === 0) return [];
    const limitedImages = images.slice(0, MAX_IMAGES);
    return shuffleArray(limitedImages);
  }, [images]);

  // 초기 이미지 설정
  useEffect(() => {
    const prepared = prepareImages();
    setDisplayImages(prepared);
    setCurrentIndex(0);
  }, []);

  // 다음 이미지로 이동
  const goToNext = useCallback(async () => {
    if (displayImages.length === 0) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => {
        const nextIndex = prev + 1;
        // 모든 이미지를 다 본 경우
        if (nextIndex >= displayImages.length) {
          // refreshDirectory 호출 후 새 이미지 목록으로 갱신
          refreshDirectory().then(() => {
            // 잠시 후에 새 이미지 목록 준비 (refreshDirectory가 완료된 후)
            setTimeout(() => {
              const newImages = prepareImages();
              setDisplayImages(newImages);
            }, 500);
          });
          return 0;
        }
        return nextIndex;
      });
      setIsTransitioning(false);
    }, 300);
  }, [displayImages.length, refreshDirectory, prepareImages]);

  // 이전 이미지로 이동
  const goToPrev = useCallback(() => {
    if (displayImages.length === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + displayImages.length) % displayImages.length);
      setIsTransitioning(false);
    }, 300);
  }, [displayImages.length]);

  // 자동 재생 타이머
  useEffect(() => {
    if (isPaused || displayImages.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      goToNext();
    }, intervalTime * 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, intervalTime, goToNext, displayImages.length]);

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(prev => !prev);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  // 마우스 움직임 감지하여 컨트롤 표시
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      if (!isPaused) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPaused]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  // images prop이 변경되면 displayImages 업데이트 (refreshDirectory 후)
  useEffect(() => {
    if (images && images.length > 0 && displayImages.length === 0) {
      const prepared = prepareImages();
      setDisplayImages(prepared);
    }
  }, [images, displayImages.length, prepareImages]);

  const currentImage = displayImages[currentIndex];

  if (!currentImage) {
    return (
      <div className="viewing-mode-overlay" onClick={onClose}>
        <div className="viewing-mode-empty">
          <p>표시할 이미지가 없습니다</p>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="viewing-mode-overlay" 
      onMouseMove={handleMouseMove}
    >
      {/* 메인 이미지 */}
      <div className={`viewing-mode-image-container ${isTransitioning ? 'transitioning' : ''}`}>
        <img
          src={`${API_URL}/images/${currentImage.id}`}
          alt={currentImage.positive_prompt || '이미지'}
          className="viewing-mode-image"
        />
      </div>

      {/* 컨트롤 패널 */}
      <div className={`viewing-mode-controls ${showControls ? 'visible' : 'hidden'}`}>
        {/* 상단 컨트롤 */}
        <div className="viewing-mode-header">
          <div className="viewing-mode-counter">
            {currentIndex + 1} / {displayImages.length}
          </div>
          <button className="viewing-mode-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 하단 컨트롤 */}
        <div className="viewing-mode-footer">
          {/* 진행 바 */}
          <div className="viewing-mode-progress">
            {displayImages.map((_, idx) => (
              <div 
                key={idx} 
                className={`progress-dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'viewed' : ''}`}
                onClick={() => setCurrentIndex(idx)}
              />
            ))}
          </div>

          {/* 컨트롤 버튼 */}
          <div className="viewing-mode-buttons">
            <button onClick={goToPrev} className="control-btn">
              ◀ 이전
            </button>
            
            <button 
              onClick={() => setIsPaused(prev => !prev)} 
              className="control-btn play-pause"
            >
              {isPaused ? '▶ 재생' : '⏸ 일시정지'}
            </button>
            
            <button onClick={goToNext} className="control-btn">
              다음 ▶
            </button>
          </div>

          {/* 속도 조절 */}
          <div className="viewing-mode-speed">
            <label>
              전환 속도: {intervalTime}초
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={intervalTime}
              onChange={(e) => setIntervalTime(Number(e.target.value))}
              className="speed-slider"
            />
            <div className="speed-presets">
              <button onClick={() => setIntervalTime(2)}>빠름</button>
              <button onClick={() => setIntervalTime(5)}>보통</button>
              <button onClick={() => setIntervalTime(10)}>느림</button>
            </div>
          </div>

          {/* 안내 텍스트 */}
          <div className="viewing-mode-hint">
            <span>Space: 일시정지 | ←→: 이전/다음 | ESC: 종료</span>
          </div>
        </div>
      </div>

      {/* 네비게이션 영역 (화면 좌우 클릭) */}
      <div className="viewing-mode-nav-left" onClick={goToPrev} />
      <div className="viewing-mode-nav-right" onClick={goToNext} />
    </div>
  );
};
