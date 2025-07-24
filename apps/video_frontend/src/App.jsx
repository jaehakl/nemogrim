import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import VideoUpload from './components/VideoUpload';
import VideoDetail from './components/VideoDetail';
import FavoritesPage from './components/FavoritesPage';
import './App.css'; // 필요에 따라 CSS 파일 생성


function App() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  return (
    <div className="App">
      <Navbar onUploadClick={handleUploadClick} />
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