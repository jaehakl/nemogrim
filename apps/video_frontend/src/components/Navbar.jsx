import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Navbar.css';

function Navbar({ onUploadClick }) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
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

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1>비디오 플랫폼</h1>
        </div>
        <div className="navbar-nav">
          <button 
            className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`}
            onClick={() => handleNavigation('/')}
          >
            <span className="nav-icon">📺</span>
            전체 영상
          </button>
          <button 
            className={`nav-btn ${location.pathname === '/favorites' ? 'active' : ''}`}
            onClick={() => handleNavigation('/favorites')}
          >
            <span className="nav-icon">⭐</span>
            즐겨찾기
          </button>
        </div>
        <div className="navbar-actions">
          <button 
            className="upload-btn"
            onClick={handleUploadClick}
          >
            <span className="upload-icon">📁</span>
            영상 업로드
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 