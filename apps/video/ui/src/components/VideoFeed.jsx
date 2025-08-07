import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { listVideos } from '../api/api';
import VideoPlayer from './VideoPlayer';
import './VideoFeed.css';

function VideoFeed() {
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoStartTimes, setVideoStartTimes] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const videosPerPage = 15;

  // 키워드 토글 핸들러
  const handleKeywordToggle = useCallback((keyword) => {
    setSelectedKeywords(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword);
      } else {
        return [...prev, keyword];
      }
    });
    setCurrentPage(0); // 키워드 변경 시 첫 페이지로 이동
  }, []);

  // 선택된 키워드로 영상 필터링
  const filteredVideos = useMemo(() => {
    if (!Array.isArray(videos)) {
      return [];
    }
    
    if (selectedKeywords.length === 0) {
      return videos; // 키워드가 선택되지 않으면 모든 영상 표시
    }
    
    return videos.filter(video => {
      // 영상의 키워드가 선택된 모든 키워드를 포함하는지 확인 (교집합)
      const videoKeywords = video.keywords || [];
      return selectedKeywords.every(selectedKeyword => 
        videoKeywords.includes(selectedKeyword)
      );
    });
  }, [videos, selectedKeywords]);

  // 비디오 목록 가져오기
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listVideos();
      // API 응답이 배열인지 확인하고 안전하게 설정
      const videosData = Array.isArray(response.data.videos) ? response.data.videos : [];
      setVideos(videosData);
      setKeywords(response.data.keywords);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setError("비디오 목록을 불러오는데 실패했습니다.");
      setVideos([]); // 오류 시 빈 배열로 설정
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

    const handleVideoDeleted = (event) => {
      const { videoId } = event.detail;
      setVideos(prev => prev.filter(video => video.id !== videoId));
    };

    window.addEventListener('videoUploadSuccess', handleUploadSuccess);
    window.addEventListener('videoDeleted', handleVideoDeleted);
    
    return () => {
      window.removeEventListener('videoUploadSuccess', handleUploadSuccess);
      window.removeEventListener('videoDeleted', handleVideoDeleted);
    };
  }, [fetchVideos]);

  // 영상 로드 시 시작 시간 설정
  useEffect(() => {
    if (!Array.isArray(videos)) {
      return;
    }
    const newStartTimes = {};
    videos.forEach((video) => {
      if (!videoStartTimes[video.filename]) {
        // 1200~3600초(20~60분) 사이의 무작위 시작 시간 설정
        newStartTimes[video.filename] = Math.random() * 1200;
      }
    });
    if (Object.keys(newStartTimes).length > 0) {
      setVideoStartTimes(prev => ({ ...prev, ...newStartTimes }));
    }
  }, [videos]);

  // 현재 페이지의 영상들 계산
  const displayedVideos = useMemo(() => {
    if (!Array.isArray(filteredVideos)) {
      return [];
    }
    const startIndex = currentPage * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    return filteredVideos.slice(startIndex, endIndex);
  }, [filteredVideos, currentPage, videosPerPage]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const totalPages = Math.ceil((Array.isArray(filteredVideos) ? filteredVideos.length : 0) / videosPerPage);

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
        <h2>업로드된 영상 ({Array.isArray(filteredVideos) ? filteredVideos.length : 0}개)</h2>
        {selectedKeywords.length > 0 && (
          <p className="filter-info">선택된 키워드: {selectedKeywords.join(', ')}</p>
        )}
      </div>
      <div className="keyword-list">
        {keywords.map((keyword) => (
          <button 
            key={keyword} 
            className={`keyword-btn ${selectedKeywords.includes(keyword) ? 'selected' : ''}`}
            onClick={() => handleKeywordToggle(keyword)}
          >
            {keyword}
          </button>
        ))}
      </div>
      
      {!Array.isArray(filteredVideos) || filteredVideos.length === 0 ? (
        <p>{selectedKeywords.length > 0 ? '선택된 키워드에 해당하는 영상이 없습니다.' : '아직 업로드된 영상이 없습니다.'}</p>
      ) : (
        <>
          <div className="video-grid">
            {displayedVideos.map((video) => (
              <VideoPlayer
                key={video.filename}
                video={video}
                videoStartTime={videoStartTimes[video.filename] || 0}
                maxHistoryDisplay={5}
                defaultExpanded={false}
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