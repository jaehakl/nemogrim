import React, { useState, useEffect, useCallback } from 'react';
import { getAllFavorites, createThumbnailForHistory, batchCreateThumbnails } from '../api/api';
import VideoPlayer from './VideoPlayer';
import './VideoFeed.css';

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({});

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
    } catch (error) {
      console.error("Error fetching favorites:", error);
      setError("즐겨찾기 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 썸네일이 없는 즐겨찾기들 필터링
  const noThumbnailFavorites = favorites.filter(fav => !fav.thumbnail);

  // 썸네일 일괄 생성 (병렬 처리 + 실시간 진행상황)
  const generateThumbnails = useCallback(async () => {
    if (noThumbnailFavorites.length === 0) {
      alert('썸네일을 생성할 즐겨찾기가 없습니다.');
      return;
    }

    try {
      setThumbnailGenerating(true);
      setThumbnailProgress({});
      
      // 모든 썸네일을 "처리 중" 상태로 초기화
      const initialProgress = {};
      noThumbnailFavorites.forEach((fav, index) => {
        initialProgress[fav.historyId] = {
          status: 'processing',
          message: `대기 중... (${index + 1}/${noThumbnailFavorites.length})`,
          progress: 0
        };
      });
      setThumbnailProgress(initialProgress);
      
      // 병렬로 썸네일 생성 API 호출 (각각 개별적으로 상태 업데이트)
      const promises = noThumbnailFavorites.map((fav, index) => {
        return createThumbnailForHistory(fav.historyId)
          .then(result => {
            // 성공 시 즉시 상태 업데이트
            setThumbnailProgress(prev => ({
              ...prev,
              [fav.historyId]: {
                status: 'success',
                message: '완료',
                progress: 100
              }
            }));
            return { success: true, historyId: fav.historyId, result };
          })
          .catch(error => {
            console.error(`썸네일 생성 실패 (historyId: ${fav.historyId}):`, error);
            
            // 실패 시 즉시 상태 업데이트
            setThumbnailProgress(prev => ({
              ...prev,
              [fav.historyId]: {
                status: 'error',
                message: '실패',
                progress: 100,
                error: error.message
              }
            }));
            
            return { 
              success: false, 
              historyId: fav.historyId, 
              error: error.message 
            };
          });
      });

      // 모든 작업 완료 대기
      const results = await Promise.all(promises);
      
      // 전체 결과 확인
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (failCount > 0) {
        alert(`썸네일 생성 완료: ${successCount}개 성공, ${failCount}개 실패`);
      } else {
        alert(`${successCount}개의 썸네일이 성공적으로 생성되었습니다.`);
      }
      
      // 목록 새로고침
      await fetchFavorites();
      
      // 진행상황 초기화 (3초 후)
      setTimeout(() => {
        setThumbnailProgress({});
      }, 3000);
      
    } catch (error) {
      console.error("썸네일 생성 중 오류:", error);
      alert('썸네일 생성 중 오류가 발생했습니다.');
    } finally {
      setThumbnailGenerating(false);
    }
  }, [noThumbnailFavorites, fetchFavorites]);

  // 컴포넌트 마운트 시 즐겨찾기 목록 가져오기
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // 진행상황 표시 컴포넌트
  const ProgressIndicator = ({ historyId, progress }) => {
    if (!progress || !progress[historyId]) return null;
    
    const { status, message, progress: percent } = progress[historyId];
    
    const getStatusColor = () => {
      switch (status) {
        case 'processing': return '#007bff';
        case 'success': return '#28a745';
        case 'error': return '#dc3545';
        default: return '#6c757d';
      }
    };

    const pulseAnimation = status === 'processing' ? {
      animation: 'pulse 1s infinite'
    } : {};

    return (
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          ...pulseAnimation
        }}></div>
        <span>{message}</span>
      </div>
    );
  };

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="video-feed">
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
      <div className="video-feed">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchFavorites} className="retry-btn">다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-feed">
      <div className="header-controls">
        <h2>즐겨찾기 영상 ({favorites.length}개)</h2>
        {noThumbnailFavorites.length > 0 && (
          <button 
            onClick={generateThumbnails}
            disabled={thumbnailGenerating}
            className="generate-thumbnails-btn"
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: thumbnailGenerating ? 'not-allowed' : 'pointer',
              opacity: thumbnailGenerating ? 0.6 : 1
            }}
          >
            {thumbnailGenerating 
              ? `썸네일 생성 중... (${noThumbnailFavorites.length}개)` 
              : `썸네일 일괄 생성 (${noThumbnailFavorites.length}개)`
            }
          </button>
        )}
      </div>
      
      {favorites.length === 0 ? (
        <div className="empty-state">
          <p>즐겨찾기된 영상이 없습니다.</p>
        </div>
      ) : (
        <div className="video-grid">
          {favorites.map((video) => (
            <div key={`${video.filename}_${video.historyId}`} style={{ position: 'relative' }}>
              <VideoPlayer
                video={video}
                videoStartTime={video.favoriteTime}
                maxHistoryDisplay={3}
                defaultExpanded={false}
              />
              <ProgressIndicator historyId={video.historyId} progress={thumbnailProgress} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FavoritesPage; 