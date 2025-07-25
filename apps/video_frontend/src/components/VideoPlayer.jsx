import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createHistory, getVideoHistory, toggleFavorite, deleteHistory, deleteVideo } from '../api/api';
import './VideoPlayer.css';

function VideoPlayer({ 
  video, 
  videoStartTime = 0,
  maxHistoryDisplay = 3,
  defaultExpanded = true
}) {
  const navigate = useNavigate();
  const [playHistory, setPlayHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [playStartTimes, setPlayStartTimes] = useState({});
  const [recordedVideos, setRecordedVideos] = useState(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(defaultExpanded);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const videoRef = useRef(null);

  // 영상 삭제 핸들러
  const handleDeleteVideo = useCallback(async () => {
    if (!window.confirm('정말로 이 영상을 삭제하시겠습니까?\n삭제된 영상은 복구할 수 없습니다.')) {
      return;
    }

    try {
      await deleteVideo(video.id);
      alert('영상이 성공적으로 삭제되었습니다.');
      // 부모 컴포넌트에서 영상 목록을 새로고침하도록 이벤트 발생
      window.dispatchEvent(new CustomEvent('videoDeleted', { detail: { videoId: video.id } }));
    } catch (error) {
      console.error('영상 삭제 실패:', error);
      alert('영상 삭제에 실패했습니다.');
    }
  }, [video.id]);

  // 비디오 로드 완료 시 시작 시간 설정
  const handleVideoLoad = useCallback(() => {
    if (videoRef.current && videoStartTime > 0) {
      videoRef.current.currentTime = videoStartTime;
    }
  }, [videoStartTime]);

  // 재생 기록 자동 로드
  useEffect(() => {
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
  }, [video.id]);

  // 재생 기록 저장
  const savePlayHistory = useCallback(async (currentTime) => {
    try {
      const videoDuration = videoRef.current ? videoRef.current.duration : null;

      const response = await createHistory({
        video_id: video.id,
        current_time: currentTime,
        video_duration: videoDuration,
        is_favorite: false,
        keywords: "",
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

  // 즐겨찾기 필터 토글
  const handleFilterToggle = useCallback(() => {
    setShowFavoritesOnly(prev => !prev);
  }, []);

  // 재생 기록 펼치기/접기 토글
  const handleHistoryToggle = useCallback(() => {
    setShowThumbnail(false);
    setIsHistoryExpanded(prev => !prev);
  }, []);

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
      
      if (playDuration >= 15000 && videoTimeDiff < 1000 && !recordedVideos.has(video.id)) {
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

  return (
    <div className="video-player-item">
      <div className="video-header">
        <h3 
          className="video-title"
          onClick={() => navigate(`/video/${video.id}`)}
          title={`${video.actor || video.title} - 클릭하여 상세보기`}
        >
          {video.actor || video.title}
        </h3>
        <button 
          className="delete-video-btn"
          onClick={handleDeleteVideo}
          title="영상 삭제"
        >
          ✕
        </button>
      </div>
      <div className="video-text">
        {video.title && <p className="keywords">{video.title}</p>}
        {video.keywords && <p className="keywords">키워드: {video.keywords}</p>}
      </div>
      
      
      {/* 비디오 플레이어 또는 썸네일 */}
      {video.thumbnail && showThumbnail ? (
        <div className="thumbnail-container">
          <img 
            src={'/api/' + video.thumbnail} 
            alt="비디오 썸네일"
            width="320" 
            height="240"
            style={{ objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => {
              // 썸네일 클릭 시 비디오 플레이어로 전환
              setShowThumbnail(false);
            }}
            title="클릭하여 비디오 재생"
          />
          <div className="thumbnail-overlay">
            <button 
              className="play-button"
              onClick={() => setShowThumbnail(false)}
              title="비디오 재생"
            >
              ▶
            </button>
          </div>
        </div>
      ) : (
        <video 
          controls 
          width="320" 
          height="240"
          muted
          preload="metadata"
          onLoadedMetadata={handleVideoLoad}
          onPlay={handlePlayStart}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          ref={videoRef}
        >
          <source src={'/api/' + video.url} />        
        </video>
      )}
      
      {/* 재생 기록 표시 */}
      {playHistory.length > 0 && (
        <div className={`play-history ${!isHistoryExpanded ? 'collapsed' : ''}`}>
          <div className="history-header">
            <h4>재생 기록 ({playHistory.length}개)</h4>
            <div className="history-controls">
              <button 
                className={`filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                onClick={handleFilterToggle}
                title={showFavoritesOnly ? '모든 기록 보기' : '즐겨찾기만 보기'}
              >
                {showFavoritesOnly ? '전체' : '즐겨찾기'}
              </button>
              <button 
                className="expand-btn"
                onClick={handleHistoryToggle}
                title={isHistoryExpanded ? '재생 기록 접기' : '재생 기록 펼치기'}
              >
                {isHistoryExpanded ? '▼' : '▶'}
              </button>
            </div>
          </div>
          {isHistoryExpanded && (
            <div className="history-list">
              {playHistory
                .filter(entry => !showFavoritesOnly || entry.is_favorite)
                .sort((a, b) => a.currentTime - b.currentTime)
                .slice(maxHistoryDisplay === -1 ? undefined : -maxHistoryDisplay)
                .map((entry, index) => (
                <div key={index} className="history-item">
                  <div 
                    className="history-info"
                    onClick={() => handleHistoryClick(entry.currentTime)}
                    title="클릭하여 해당 시점으로 이동"
                  >
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
          )}
        </div>
      )}
    </div>
  );
}

export default VideoPlayer; 