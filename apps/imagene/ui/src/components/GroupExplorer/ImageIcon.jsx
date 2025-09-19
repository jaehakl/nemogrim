import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '../../api/api';
import { useImageFilter } from '../../contexts/ImageFilterContext';

export const ImageIcon = ({ 
  image
}) => {
  const { selectedImageIds, setSelectedImageIds, toggleSelectImage, setHoveredImage } = useImageFilter();
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const contextMenuRef = useRef(null);
  
  const isSelected = selectedImageIds.has(image.id);

  const handleImageClick = (e, imageId) => {
    if (imageId === null) {
      setSelectedImageIds(new Set());
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // Ctrl 또는 Cmd 키를 누르고 클릭한 경우 토글
      toggleSelectImage(imageId);
    } else {
      // Ctrl 키를 누르지 않고 클릭한 경우 모든 선택 해제 후 해당 이미지만 선택
      setSelectedImageIds(new Set([imageId]));
    }
  };

  const handleDragStart = (e) => {
    if (!isSelected) {
      toggleSelectImage(image.id);
    }
  };

  const handleMouseEnter = () => {
    setHoveredImage(image);
  };

  const handleMouseLeave = () => {
    setHoveredImage(null);
  };

  const handleRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleContextMenuAction = (action) => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    if (action === 'copyPrompt') {
      navigator.clipboard.writeText(image.positive_prompt).then(() => {
        console.log('프롬프트가 클립보드에 복사되었습니다.');
      }).catch((error) => {
        console.error('클립보드 복사 실패:', error);
      });
    }
  };

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  return (
    <>
      <div 
        key={image.id} 
        className={`grid-item image-item ${isSelected ? 'selected' : ''}`}
        title={image.positive_prompt}
        onDragStart={handleDragStart}
        onContextMenu={handleRightClick}
        onClick={(e) => {e.preventDefault(); e.stopPropagation(); handleImageClick(e, image.id)}}
      >
        <img 
          src={API_URL + '/' + image.url} 
          alt={image.name || `Image ${image.id}`}
          className="image-preview"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}  
        />
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
        >
          <div 
            className="context-menu-item"
            onClick={(e) => {e.preventDefault(); e.stopPropagation(); handleContextMenuAction('copyPrompt')}}
          >
            프롬프트 복사
          </div>
        </div>
      )}
    </>
  );
};
