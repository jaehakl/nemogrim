import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import VideoUpload from './components/VideoUpload';
import VideoDetail from './components/VideoDetail';
import FavoritesPage from './components/FavoritesPage';
import VideoListPage from './components/VideoListPage';
import './App.css'; // 필요에 따라 CSS 파일 생성


function App() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  const handleSyncComplete = () => {
    // 동기화 완료 후 페이지 새로고침 또는 비디오 목록 업데이트
    window.location.reload();
  };

  return (
    <div className="App">
      <Navbar onUploadClick={handleUploadClick} onSyncComplete={handleSyncComplete} />
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={<VideoFeed />} 
          />
          <Route 
            path="/video/:videoId" 
            element={<VideoDetail />} 
          />
          <Route 
            path="/favorites" 
            element={<FavoritesPage />} 
          />
          <Route 
            path="/video-list" 
            element={<VideoListPage />} 
          />
        </Routes>
          {isUploadModalOpen && (
                  <div className="modal-overlay">
                    <div className="modal-content">
                      <div className="modal-header">
                        <h2>영상 업로드</h2>
                        <button className="close-btn" onClick={handleCloseUploadModal}>
                          ✕
                        </button>
                      </div>
                      <VideoUpload />
                    </div>
                  </div>
                )}
      </main>
    </div>
  );
}

export default App;