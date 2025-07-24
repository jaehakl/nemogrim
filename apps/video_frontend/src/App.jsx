import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import VideoFeed from './components/VideoFeed';
import VideoUpload from './components/VideoUpload';
import VideoDetail from './components/VideoDetail';
import FavoritesPage from './components/FavoritesPage';
import './App.css'; // 필요에 따라 CSS 파일 생성


function App() {
  const API_BASE_URL = 'http://localhost:8000';
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
            element={
              <>
                <VideoFeed API_BASE_URL={API_BASE_URL} />
              </>
            } 
          />
          <Route 
            path="/video/:videoId" 
            element={<VideoDetail API_BASE_URL={API_BASE_URL} />} 
          />
          <Route 
            path="/favorites" 
            element={<FavoritesPage API_BASE_URL={API_BASE_URL} />} 
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
                      <VideoUpload API_BASE_URL={API_BASE_URL} />
                    </div>
                  </div>
                )}
      </main>
    </div>
  );
}

export default App;