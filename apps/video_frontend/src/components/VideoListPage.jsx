import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllFavorites } from '../api/api';
import './VideoListPage.css';

function VideoListPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(null);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const videoRef = useRef(null);

  // 즐겨찾기 목록 가져오기
  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllFavorites();
      const favoritesData = response.data.map(favorite => {
        return {
          id: favorite.video.id,
          filename: favorite.video.filename,
          title: favorite.video.title,
          actor: favorite.video.actor,
          thumbnail: favorite.thumbnail,
          url: favorite.video.url || `/videos/${favorite.video.filename}`,
          favoriteTime: favorite.current_time || 0,
          favoriteDate: new Date(favorite.timestamp).toLocaleDateString('ko-KR'),
          favoriteTimeStr: new Date(favorite.timestamp).toLocaleTimeString('ko-KR'),
          favoriteKey: favorite.id,
          historyId: favorite.id
        };
      });
      setFavorites(favoritesData);
      
      // 첫 번째 비디오를 기본 선택
      if (favoritesData.length > 0 && !selectedVideo) {
        setSelectedVideo(favoritesData[0]);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
      setError("즐겨찾기 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedVideo]);



    // 비디오 재생 함수
  const playVideoAtTime = (video, startTime) => {
    if (!videoRef.current) return;
    
    const playVideo = () => {
      try {
        videoRef.current.currentTime = startTime;
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('비디오 재생 시작:', video.title);
            })
            .catch(error => {
              console.error('비디오 재생 실패:', error);
              // 재생 실패 시 다시 시도
              setTimeout(() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(e => console.error('재시도 실패:', e));
                }
              }, 500);
            });
        }
      } catch (error) {
        console.error('비디오 재생 중 오류:', error);
      }
    };

    // 비디오가 로드되었는지 확인
    if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
        playVideo()
    } else {
      // 비디오 로드 대기
      const handleCanPlay = () => {
        if (videoRef.current) {
          playVideo();
          videoRef.current.removeEventListener('canplay', handleCanPlay);
        }
      };
      videoRef.current.addEventListener('canplay', handleCanPlay);
    }
  };

  // 랜덤 비디오 선택 함수
  const selectRandomVideo = () => {
    if (favorites.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * favorites.length);
    const randomVideo = favorites[randomIndex];
    setSelectedVideo(randomVideo);
    // useEffect에서 자동으로 source 변경 및 재생 처리
  };

  // 자동 재생 시작/중지 핸들러
  const handleAutoPlayToggle = () => {
    if (isAutoPlay) {
      // 자동 재생 중지
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        setAutoPlayInterval(null);
      }
      setIsAutoPlay(false);
    } else {
      // 자동 재생 시작
      if (favorites.length === 0) {
        alert('재생할 비디오가 없습니다.');
        return;
      }
      
      // 즉시 첫 번째 랜덤 비디오 재생
      selectRandomVideo();
      
      // 설정된 간격으로 랜덤 비디오 변경
      const interval = setInterval(selectRandomVideo, intervalSeconds * 1000);
      setAutoPlayInterval(interval);
      setIsAutoPlay(true);
    }
  };

  // 비디오 선택 및 재생 핸들러
  const handleVideoSelect = (video) => {
    // 자동 재생 중이면 중지
    if (isAutoPlay) {
      handleAutoPlayToggle();
    }
    
    setSelectedVideo(video);
    // useEffect에서 자동으로 source 변경 및 재생 처리
  };

  // 컴포넌트 마운트 시 즐겨찾기 목록 가져오기
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // selectedVideo가 변경될 때 source 업데이트
  useEffect(() => {
    if (videoRef.current && selectedVideo) {
      // source 변경
      videoRef.current.src = "/api/" + selectedVideo.url;
      
      // 비디오 로드 후 재생
      const handleCanPlay = () => {
        if (videoRef.current) {
          playVideoAtTime(selectedVideo, selectedVideo.favoriteTime);
          videoRef.current.removeEventListener('canplay', handleCanPlay);
        } else {
            setTimeout(() => {
                handleCanPlay();
            }, 500);
        }
      };
      
      videoRef.current.addEventListener('canplay', handleCanPlay);
    }
  }, [selectedVideo]);

  // 컴포넌트 언마운트 시 인터벌 정리
  useEffect(() => {
    return () => {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
      }
    };
  }, [autoPlayInterval]);

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="video-list-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>즐겨찾기 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태 표시
  if (error) {
    return (
      <div className="video-list-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchFavorites} className="retry-btn">다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-list-page">
      <div className="video-list-container">
        {/* 비디오 플레이어 섹션 */}
        <div className="video-player-section">
            <div 
              className="video-title-link"
              onClick={() => navigate(`/video/${selectedVideo?.id}`)}
            >
              <h3>{selectedVideo?.title} {selectedVideo?.actor}</h3>
            </div>
          <div className="video-player-wrapper">
            <video
              ref={videoRef}
              controls
              width="100%"
              height="auto"
              style={{ maxHeight: '100%' }}
            >
              {selectedVideo ? (
                <source src={"/api/" + selectedVideo.url} type="video/mp4" />
              ) : (
                <source src="" type="video/mp4" />
              )}
              브라우저가 비디오 태그를 지원하지 않습니다.
            </video>
          </div>
        </div>

        {/* 리스트뷰 섹션 */}
        <div className="list-view-section">
          <div className="video-player-header">
            <button 
              onClick={handleAutoPlayToggle}
              className={`auto-play-btn ${isAutoPlay ? 'active' : ''}`}
              disabled={favorites.length === 0}
            >
              {isAutoPlay ? `🔄 자동재생 중지 (${intervalSeconds}초)` : '▶️ 자동재생 시작'}
            </button>
            <div className="interval-controls">
              <label htmlFor="interval-input">인터벌 (초):</label>
              <input
                id="interval-input"
                type="number"
                min="1"
                max="60"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(parseInt(e.target.value) || 6)}
                disabled={isAutoPlay}
                className="interval-input"
              />
            </div>
          </div>          

          <h2>즐겨찾기 목록 ({favorites.length}개)</h2>
          
          {favorites.length === 0 ? (
            <div className="empty-state">
              <p>즐겨찾기된 영상이 없습니다.</p>
            </div>
          ) : (
            <div className="video-list">
              {favorites.map((video) => (
                <div
                  key={`${video.filename}_${video.historyId}`}
                  className={`video-list-item ${selectedVideo?.historyId === video.historyId ? 'selected' : ''}`}
                  onClick={() => handleVideoSelect(video)}
                >
                  <div className="video-thumbnail">
                    {video.thumbnail ? (
                      <img src={"/api/" + video.thumbnail} alt={video.title} />
                    ) : (
                      <div className="no-thumbnail">
                        <span>썸네일 없음</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h4 className="video-title">{video.title}</h4>
                    <p className="video-actor">{video.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoListPage; 