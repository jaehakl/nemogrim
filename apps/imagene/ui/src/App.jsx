import React, { useState } from 'react';
import { Container, Content, Sidebar, Divider } from 'rsuite';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ContentArea } from './pages/ContentArea/ContentArea';
import { ImageGenPage } from './pages/ImageGenPage/ImageGenPage';
import { ImageStatistics } from './components/ImageStatistics/ImageStatistics';
import { Navbar } from './components/Navbar/Navbar';
import { Groups } from './components/Groups/Groups';
import { GroupExplorer } from './components/GroupExplorer/GroupExplorer';

import './App.css';


function App() {  
  const [leftWidth, setLeftWidth] = useState(70);

  const handleResize = (e) => {
    const container = document.querySelector('.resizable-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
    
    // 최소 20%, 최대 80%로 제한
    const clampedWidth = Math.min(Math.max(newLeftWidth, 20), 80);
    setLeftWidth(clampedWidth);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    
    const handleMouseMove = (e) => handleResize(e);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="app-container">
      <Navbar />
      <div className="app-home">
        <div className="resizable-container">
          <div 
            className="left-panel" 
            style={{ width: `${leftWidth}%` }}
          >
            <GroupExplorer />
          </div>
          <div 
            className="resize-handle"
            onMouseDown={handleMouseDown}
          />
          <div 
            className="right-panel" 
            style={{ width: `${100 - leftWidth}%` }}
          >
            <ContentArea />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;