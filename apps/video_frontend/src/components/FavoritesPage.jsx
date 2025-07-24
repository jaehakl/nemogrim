import React, { useState, useEffect, useCallback } from 'react';
import { getAllFavorites } from '../api/api';
import VideoPlayer from './VideoPlayer';
import './VideoFeed.css';

function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // 컴포넌트 마운트 시 즐겨찾기 목록 가져오기
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

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
      </div>
      
      {favorites.length === 0 ? (
        <div className="empty-state">
          <p>즐겨찾기된 영상이 없습니다.</p>
        </div>
      ) : (
        <div className="video-grid">
          {favorites.map((video) => (
            <VideoPlayer
              key={`${video.filename}_${video.historyId}`}
              video={video}
              videoStartTime={video.favoriteTime}
              maxHistoryDisplay={3}
              defaultExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FavoritesPage; 