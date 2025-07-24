import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createHistory, getVideoHistory, toggleFavorite, deleteHistory } from '../api/api';
import './VideoPlayer.css';

function VideoPlayer({ 
  video, 
  API_BASE_URL, 
  videoStartTime = 0,
  maxHistoryDisplay = 3
}) {
  const navigate = useNavigate();
  const [playHistory, setPlayHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [playStartTimes, setPlayStartTimes] = useState({});
  const [recordedVideos, setRecordedVideos] = useState(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const [initialTimeSet, setInitialTimeSet] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const observerRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Intersection Observer 설정
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observerRef.current.observe(containerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // 시청 기록 자동 로드
  useEffect(() => {
    if (isVisible && !historyLoading) {
      const loadVideoHistory = async () => {
        setHistoryLoading(true);
        try {
          const response = await getVideoHistory(video.id);
          const historyData = response.data.map(history => ({
            id: history.id,
            timestamp: history.timestamp,
            currentTime: history.current_time,
            date: new Date(history.timestamp).toLocaleDateString('ko-KR'),
            time: new Date(history.timestamp).toLocaleTimeString('ko-KR'),
            is_favorite: history.is_favorite
          }));
          setPlayHistory(historyData);
        } catch (error) {
          console.error('시청 기록 로드 실패:', error);
        } finally {
          setHistoryLoading(false);
        }
      };
      
      loadVideoHistory();
    }
  }, [isVisible, video.id]);

  // 재생 기록 저장
  const savePlayHistory = useCallback(async (currentTime) => {
    try {
      const response = await createHistory({
        video_id: video.id,
        current_time: currentTime,
        is_favorite: false,
        keywords: ""
      });
      
      const newHistoryEntry = {
        id: response.data.id,
        timestamp: response.data.timestamp,
        currentTime: currentTime,
        date: new Date(response.data.timestamp).toLocaleDateString('ko-KR'),
        time: new Date(response.data.timestamp).toLocaleTimeString('ko-KR'),
        is_favorite: false
      };
      
      setPlayHistory(prev => {
        const newHistory = [...prev, newHistoryEntry];
        // 30개를 넘으면 오래된 것부터 삭제
        const trimmedHistory = newHistory.length > 30 
          ? newHistory.slice(-30) 
          : newHistory;
        
        return trimmedHistory;
      });
    } catch (error) {
      console.error('재생 기록 저장 실패:', error);
    }
  }, [video.id]);

  // 즐겨찾기 토글 핸들러
  const handleToggleFavorite = useCallback(async (historyId) => {
    try {
      const response = await toggleFavorite(historyId);
      
      setPlayHistory(prev => {
        const newHistory = prev.map(entry => {
          if (entry.id === historyId) {
            return { ...entry, is_favorite: response.data.is_favorite };
          }
          return entry;
        });
        
        return newHistory;
      });
    } catch (error) {
      console.error('즐겨찾기 토글 실패:', error);
    }
  }, []);

  // 재생 기록 삭제 핸들러
  const handleDeleteHistory = useCallback(async (historyId) => {
    try {
      await deleteHistory(historyId);
      
      setPlayHistory(prev => {
        const newHistory = prev.filter(entry => entry.id !== historyId);
        return newHistory;
      });
    } catch (error) {
      console.error('재생 기록 삭제 실패:', error);
      alert('재생 기록 삭제에 실패했습니다.');
    }
  }, []);

  // 재생 기록 클릭 시 해당 시간으로 이동
  const handleHistoryClick = useCallback((currentTime) => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
      // 비디오가 일시정지 상태라면 재생
      if (videoRef.current.paused) {
        videoRef.current.play();
      }
    }
  }, []);

  // 즐겨찾기 필터 토글
  const handleFilterToggle = useCallback(() => {
    setShowFavoritesOnly(prev => !prev);
  }, []);

  // 재생 시작 핸들러
  const handlePlayStart = useCallback(() => {
    if (videoRef.current) {
      setPlayStartTimes(prev => ({
        ...prev,
        [video.id]: {
          startTime: Date.now(),
          videoTime: videoRef.current.currentTime
        }
      }));
      setRecordedVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.id);
        return newSet;
      });
    }
  }, [video.id]);

  // 재생 중 핸들러
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && playStartTimes[video.id]) {
      const startInfo = playStartTimes[video.id];
      const currentTime = Date.now();
      const playDuration = currentTime - startInfo.startTime;
      const videoTimeDiff = Math.abs(videoRef.current.currentTime - startInfo.videoTime);
      
      if (playDuration >= 2000 && videoTimeDiff < 100 && !recordedVideos.has(video.id)) {
        savePlayHistory(startInfo.videoTime);
        setRecordedVideos(prev => new Set([...prev, video.id]));
      }
    }
  }, [playStartTimes, recordedVideos, video.id]);

  // 재생 정지 핸들러
  const handlePause = useCallback(() => {
    setPlayStartTimes(prev => {
      const newTimes = { ...prev };
      delete newTimes[video.id];
      return newTimes;
    });
  }, [video.id]);



  // 영상 제목 클릭 핸들러
  const handleTitleClick = useCallback(() => {
    navigate(`/video/${video.id}`);
  }, [navigate, video.id]);

  // 비디오 로드 완료 시 시작 시간 설정
  const handleVideoLoad = useCallback(() => {
    if (videoRef.current && videoStartTime > 0 && !initialTimeSet) {
      // 약간의 지연을 두고 설정
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = videoStartTime;
          setInitialTimeSet(true);
        }
      }, 100);
    }
  }, [videoStartTime, initialTimeSet]);

  // 비디오 재생 가능 시 시작 시간 설정 (추가 보장)
  const handleCanPlay = useCallback(() => {
    if (videoRef.current && videoStartTime > 0 && !initialTimeSet) {
      // currentTime이 0이거나 videoStartTime과 다르면 설정
      if (videoRef.current.currentTime === 0 || Math.abs(videoRef.current.currentTime - videoStartTime) > 1) {
        videoRef.current.currentTime = videoStartTime;
        setInitialTimeSet(true);
      }
    }
  }, [videoStartTime, initialTimeSet]);

  // videoStartTime이 변경될 때 시작 시간 재설정
  useEffect(() => {
    // videoStartTime이 변경되면 initialTimeSet을 리셋
    setInitialTimeSet(false);
    
    if (videoRef.current && videoStartTime > 0) {
      // 비디오가 로드된 후에 currentTime 설정
      if (videoRef.current.readyState >= 1) {
        videoRef.current.currentTime = videoStartTime;
        setInitialTimeSet(true);
      }
    }
  }, [videoStartTime]);

  return (
    <div 
      className="video-player-item"
      ref={containerRef}
    >
      <div className="video-header">
        <h3 
          className="video-title"
          onClick={handleTitleClick}
          title="영상 상세보기"
        >
          {video.title || video.filename}
        </h3>
      </div>
      
      {video.actor && <p className="actor">배우: {video.actor}</p>}
      {video.keywords && <p className="keywords">키워드: {video.keywords}</p>}
      
      {/* 지연 로딩: 화면에 보이는 영상만 로드 */}
      {isVisible ? (
        <video 
          controls 
          width="320" 
          height="240"
          muted
          preload="metadata"
          onLoadedMetadata={handleVideoLoad}
          onCanPlay={handleCanPlay}
          onPlay={handlePlayStart}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          ref={videoRef}
        >
          <source src={`${API_BASE_URL}${video.url}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="video-placeholder">
          <div className="loading-spinner"></div>
          <p>로딩 중...</p>
        </div>
      )}
      
      {/* 재생 기록 표시 */}
      {playHistory.length > 0 && (
        <div className="play-history">
          <div className="history-header">
            <h4>재생 기록 ({playHistory.length}개)</h4>
            <button 
              className={`filter-btn ${showFavoritesOnly ? 'active' : ''}`}
              onClick={handleFilterToggle}
              title={showFavoritesOnly ? '모든 기록 보기' : '즐겨찾기만 보기'}
            >
              {showFavoritesOnly ? '전체' : '즐겨찾기'}
            </button>
          </div>
          <div className="history-list">
            {playHistory
              .filter(entry => !showFavoritesOnly || entry.is_favorite)
              .slice(maxHistoryDisplay === -1 ? undefined : -maxHistoryDisplay)
              .reverse()
              .map((entry, index) => (
              <div key={index} className="history-item">
                <div 
                  className="history-info"
                  onClick={() => handleHistoryClick(entry.currentTime)}
                  title="클릭하여 해당 시점으로 이동"
                >
                  <span className="history-time">{entry.time}</span>
                  <span className="history-date">{entry.date}</span>
                  <span className="history-position">
                    {Math.floor(entry.currentTime / 60)}:{(entry.currentTime % 60).toFixed(0).padStart(2, '0')}
                  </span>
                </div>
                <div className="history-actions">
                  <button 
                    className={`favorite-btn ${entry.is_favorite ? 'favorited' : ''}`}
                    onClick={() => handleToggleFavorite(entry.id)}
                    title={entry.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    {entry.is_favorite ? '★' : '☆'}
                  </button>
                  <button 
                    className="delete-history-btn"
                    onClick={() => handleDeleteHistory(entry.id)}
                    title="재생 기록 삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer; 