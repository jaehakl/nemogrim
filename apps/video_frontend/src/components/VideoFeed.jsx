import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { listVideos } from '../api/api';
import VideoPlayer from './VideoPlayer';
import './VideoFeed.css';

function VideoFeed({ API_BASE_URL }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoStartTimes, setVideoStartTimes] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const videosPerPage = 15;

  // 비디오 목록 가져오기
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listVideos();
      setVideos(response.data);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setError("비디오 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 비디오 목록 가져오기
  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // 전역 이벤트 리스너 등록 (업로드 성공 시 새로고침)
  useEffect(() => {
    const handleUploadSuccess = () => {
      fetchVideos();
    };

    window.addEventListener('videoUploadSuccess', handleUploadSuccess);
    
    return () => {
      window.removeEventListener('videoUploadSuccess', handleUploadSuccess);
    };
  }, [fetchVideos]);

  // 영상 로드 시 시작 시간 설정
  useEffect(() => {
    const newStartTimes = {};
    videos.forEach((video) => {
      if (!videoStartTimes[video.filename]) {
        // 1200~3600초(20~60분) 사이의 무작위 시작 시간 설정
        newStartTimes[video.filename] = Math.random() * 2400 + 1200;
      }
    });
    if (Object.keys(newStartTimes).length > 0) {
      setVideoStartTimes(prev => ({ ...prev, ...newStartTimes }));
    }
  }, [videos]);

  // 현재 페이지의 영상들 계산
  const displayedVideos = useMemo(() => {
    const startIndex = currentPage * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    return videos.slice(startIndex, endIndex);
  }, [videos, currentPage, videosPerPage]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);





  const totalPages = Math.ceil(videos.length / videosPerPage);

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="video-feed">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>비디오 목록을 불러오는 중...</p>
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
          <button onClick={fetchVideos} className="retry-btn">다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-feed">
      <div className="header-controls">
        <h2>업로드된 영상 ({videos.length}개)</h2>
      </div>
      
      {videos.length === 0 ? (
        <p>아직 업로드된 영상이 없습니다.</p>
      ) : (
        <>
          <div className="video-grid">
            {displayedVideos.map((video) => (
              <VideoPlayer
                key={video.filename}
                video={video}
                API_BASE_URL={API_BASE_URL}
                videoStartTime={videoStartTimes[video.filename] || 0}
                maxHistoryDisplay={5}
              />
            ))}
          </div>
          
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="page-btn"
              >
                이전
              </button>
              <span className="page-info">
                {currentPage + 1} / {totalPages}
              </span>
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="page-btn"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VideoFeed;