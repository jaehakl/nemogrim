import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { syncVideoFiles } from '../api/api';
import './Navbar.css';

function Navbar({ onUploadClick, onSyncComplete }) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick();
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSyncClick = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const response = await syncVideoFiles();
      alert(`동기화 완료!\n${response.data.message}\n새로 등록된 파일: ${response.data.new_files}개`);
      
      // 부모 컴포넌트에 동기화 완료 알림
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      console.error('동기화 중 오류 발생:', error);
      alert('동기화 중 오류가 발생했습니다: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1>NemoTV</h1>
        </div>
        <div className="navbar-nav">
          <button 
            className={`navbar-btn ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            <span className="btn-icon">📺</span>
            전체 영상
          </button>
          <button 
            className={`navbar-btn ${location.pathname === '/favorites' ? 'active' : ''}`}
            onClick={() => handleNavigation('/favorites')}
          >
            <span className="btn-icon">⭐</span>
            즐겨찾기
          </button>
          <button 
            className={`navbar-btn ${location.pathname === '/video-list' ? 'active' : ''}`}
            onClick={() => handleNavigation('/video-list')}
          >
            <span className="btn-icon">🎬</span>
            비디오 리스트
          </button>
        </div>
        <div className="navbar-actions">
          <button 
            className={`navbar-btn ${isSyncing ? 'syncing' : ''}`}
            onClick={handleSyncClick}
            disabled={isSyncing}
          >
            <span className="btn-icon">{isSyncing ? '⏳' : '🔄'}</span>
            {isSyncing ? '동기화 중...' : '파일 동기화'}
          </button>
          <button 
            className="navbar-btn"
            onClick={handleUploadClick}
          >
            <span className="btn-icon">📁</span>
            영상 업로드
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 