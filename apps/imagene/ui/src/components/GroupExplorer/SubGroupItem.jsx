import React, { useState, useRef, useEffect } from 'react';
import { API_URL, movePathBatch, editDirPath, deleteDirectory } from '../../api/api';
import './SubGroupItem.css';
import { useImageFilter } from '../../contexts/ImageFilterContext';

export const SubGroupItem = ({ subDir, label, onDirUpdated, onDrop }) => {
  const {
    setDirectory
  } = useImageFilter();

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [newDirPath, setNewDirPath] = useState('');
  const contextMenuRef = useRef(null);

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
    if (action === 'renameDir') {
      setNewDirPath(subDir.path);
      setShowEditModal(true);
    } else if (action === 'deleteDir') {
      if (window.confirm(`'${label}' 디렉토리를 삭제하시겠습니까?`)) {
        deleteDirectory(subDir.path).then(() => {
          onDirUpdated();
        }).catch((error) => {
          console.error('디렉토리 삭제 실패:', error);
          alert('디렉토리 삭제에 실패했습니다.');
        });
      }
    }
  };

  const handleEditDirPath = (prevPath, newPath) => {
    let cleanNewPath = newPath.trim();
    if (!cleanNewPath.endsWith('/')) {
      cleanNewPath = cleanNewPath + '/';
    }
    editDirPath(prevPath, cleanNewPath).then((response) => {
      setShowEditModal(false);
      setNewDirPath('');
      onDirUpdated();
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleEditDirPath(subDir.path, newDirPath.trim());
    } else if (e.key === 'Escape') {
      setShowEditModal(false);
      setNewDirPath('');
    }
  };


  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (onDrop) {
      onDrop(e, subDir.path);
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
        className="grid-item group-item"
        onContextMenu={handleRightClick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={()=>{setDirectory({path: subDir.path})}}
      >
        <div className="item-icon">
          {subDir.thumbnail_images_urls && subDir.thumbnail_images_urls.length > 0 ? (
            <div className="thumbnail-grid">
              {subDir.thumbnail_images_urls.slice(0, 4).map((url, index) => (
                <img
                  key={index}
                  src={API_URL+"/"+url}
                  alt={`Thumbnail ${index + 1}`}
                  className="thumbnail-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ))}
            </div>
          ) : (
            <span className="folder-icon">📁</span>
          )}
        </div>
        <div className="item-name">{label}</div>
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
            onClick={() => handleContextMenuAction('renameDir')}
          >
            경로 변경하기
          </div>
          <div 
            className="context-menu-item context-menu-item-danger"
            onClick={() => handleContextMenuAction('deleteDir')}
          >
            삭제하기
          </div>
        </div>
      )}

      {/* 그룹 이름 변경 모달 */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>디렉토리 경로 변경</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                value={newDirPath}
                onChange={(e) => setNewDirPath(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="새 디렉토리 경로를 입력하세요"
                className="group-name-input"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-cancel"
                onClick={() => setShowEditModal(false)}
              >
                취소
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => handleEditDirPath(subDir.path, newDirPath.trim())}
                disabled={!newDirPath.trim()}
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
