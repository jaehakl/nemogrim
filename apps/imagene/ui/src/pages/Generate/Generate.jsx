import React, { useState } from 'react';
import { ContentArea } from '../../components/ContentArea/ContentArea';
import { GroupExplorer } from '../../components/GroupExplorer/GroupExplorer';

export const Generate = () => {
  const [leftWidth, setLeftWidth] = useState(70);

  const handleResize = (e) => {
    const container = document.querySelector('.resizable-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;

    const clampedWidth = Math.min(Math.max(newLeftWidth, 20), 80);
    setLeftWidth(clampedWidth);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();

    const handleMouseMove = (event) => handleResize(event);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
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
  );
};
