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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timerRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const imagesVersionRef = useRef(0); // images 변경 추적용
  const MAX_IMAGES = 15;

  // 이미지 준비 함수 - 전체에서 무작위로 15개 선택
  const prepareImages = useCallback((sourceImages) => {
    const imgList = sourceImages || images;
    if (!imgList || imgList.length === 0) return [];
    // 먼저 전체 이미지를 셔플한 후 15개 선택
    const shuffled = shuffleArray(imgList);
    return shuffled.slice(0, MAX_IMAGES);
  }, [images]);

  // 초기 이미지 설정
  useEffect(() => {
    const prepared = prepareImages(images);
    setDisplayImages(prepared);
    setCurrentIndex(0);
    imagesVersionRef.current = images?.length || 0;
  }, []);

  // images prop이 변경되면 새 이미지 목록 준비 (refreshDirectory 완료 후)
  useEffect(() => {
    if (isRefreshing && images && images.length > 0) {
      const prepared = prepareImages(images);
      setDisplayImages(prepared);
      setCurrentIndex(0);
      setIsRefreshing(false);
      imagesVersionRef.current = images.length;
    }
  }, [images, isRefreshing, prepareImages]);

  // 다음 이미지로 이동
  const goToNext = useCallback(async () => {
    if (displayImages.length === 0 || isRefreshing) return;

    const nextIndex = currentIndex + 1;
    
    // 모든 이미지를 다 본 경우
    if (nextIndex >= displayImages.length) {
      setIsRefreshing(true);
      setIsTransitioning(true);
      
      // refreshDirectory 호출하여 백엔드에서 새 이미지 목록 가져오기
      await refreshDirectory();
      
      setIsTransitioning(false);
      // isRefreshing 상태와 images prop 변경으로 위의 useEffect가 트리거됨
      return;
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setIsTransitioning(false);
    }, 300);
  }, [displayImages.length, currentIndex, refreshDirectory, isRefreshing]);

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
    if (isPaused || displayImages.length === 0 || isRefreshing) {
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
  }, [isPaused, intervalTime, goToNext, displayImages.length, isRefreshing]);

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

  const currentImage = displayImages[currentIndex];

  // 새로고침 중 로딩 표시
  if (isRefreshing) {
    return (
      <div className="viewing-mode-overlay">
        <div className="viewing-mode-empty">
          <p>새 이미지를 불러오는 중...</p>
          <div className="viewing-mode-spinner"></div>
        </div>
      </div>
    );
  }

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
          src={`${API_URL}/${currentImage.url}`}
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
