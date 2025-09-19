import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { API_URL, movePathBatch, setImageDirectoryBatch, deletePathBatch } from '../../api/api';
import { SubGroupItem } from './SubGroupItem';
import { ImageIcon } from './ImageIcon';
import { KeywordVisualizer } from '../KeywordVisualizer/KeywordVisualizer';
import './GroupExplorer.css';

export const GroupExplorer = () => {
  const {
    directory,
    subDirs,
    images,
    refreshDirectory,
    selectedImageIds,
    setSelectedImageIds,
    toggleSelectImage,
    imageKeywords,
    userPrompt,
    setUserPrompt,
  } = useImageFilter();

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDirPath, setNewDirPath] = useState('');  
  const [currentPage, setCurrentPage] = useState(1);
  const contextMenuRef = useRef(null);
  
  const ITEMS_PER_PAGE = 30;

  function handleCreateDirectory() {
    if (selectedImageIds.size > 0) {
      setImageDirectoryBatch(directory.path + newDirPath.trim() + '/', Array.from(selectedImageIds)).then((response) => {
        setSelectedImageIds(new Set());
        setShowCreateModal(false);
        setNewDirPath('');  
        refreshDirectory();
      });             
    }
  }

  const handleDropToDirectory = (e, dirPath) => {
    if (selectedImageIds.size > 0) {
      if (e.ctrlKey || e.metaKey) {
        setImageDirectoryBatch(dirPath, Array.from(selectedImageIds)).then((response) => {
          console.log(response);
          setSelectedImageIds(new Set());
          refreshDirectory();
        });        
      } else {
        const pathChangeDict = {};
        for (const imageId of selectedImageIds) {
          const prevPath = directory.path + imageId;
          const newPath = dirPath + imageId;
          pathChangeDict[prevPath] = newPath;
        }
        movePathBatch(pathChangeDict).then((response) => {
          console.log(response);
          refreshDirectory();
        });
      }
    }
  }


  const handleRightClick = (e) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleContextMenuAction = (action) => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    if (action === 'createSubGroup') {
      setShowCreateModal(true);
    } else if (action === 'deleteSelected') {
      handleDeleteSelected();
    } else if (action === 'selectAllImages') {
      handleSelectAllImages();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateDirectory();
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewDirPath('');
    }
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedImageIds.size > 0) {
      const pathList = Array.from(selectedImageIds).map(imageId => directory.path + imageId);
      deletePathBatch(pathList).then((response) => {
        console.log(response);
        setSelectedImageIds(new Set());
        refreshDirectory();
      }).catch((error) => {
        console.error('삭제 중 오류가 발생했습니다:', error);
      });
    }
  }, [selectedImageIds, directory.path, setSelectedImageIds, refreshDirectory]);

  const handleSelectAllImages = useCallback(() => {
    if (images && images.length > 0) {
      const allImageIds = new Set(images.map(image => image.id));
      setSelectedImageIds(allImageIds);
    }
  }, [images, setSelectedImageIds]);

  // 페이지네이션 계산
  const totalPages = images ? Math.ceil(images.length / ITEMS_PER_PAGE) : 0;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentImages = images ? images.slice(startIndex, endIndex) : [];

  // 페이지 변경 핸들러
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getUpperPath = () => {
    const currentPath = directory.path || '/';
    if (currentPath === '/') {
      return; // 루트 디렉토리에서는 상위로 갈 수 없음
    }
    
    // 경로에서 마지막 폴더 제거
    const pathParts = currentPath.split('/').filter(part => part !== '');
    if (pathParts.length > 0) {
      pathParts.pop(); // 마지막 폴더 제거
      const newPath = pathParts.length > 0 ? '/' + pathParts.join('/') + '/' : '/';
      return newPath;
    }
  };

  const upperDir = {
    path: getUpperPath(),
    n_images: 0,
    thumbnail_images_urls: [],
  };

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

  // Delete 키 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' && selectedImageIds.size > 0) {
        handleDeleteSelected();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIds, handleDeleteSelected]);

  return (
    <div className="group-explorer" onContextMenu={handleRightClick} onClick={(e)=>handleImageClick(e, null)}>
      {/* 경로 헤더 */}
      <div className="group-header">
        <h2 className="group-title">{directory.path || '/'}</h2>
      </div>

      {/* 폴더 섹션 */}
        <div className="section">
          <h3 className="section-title">폴더</h3>
          <div className="grid-container">
              {upperDir.path && <SubGroupItem 
                key={upperDir.path}
                label={'..'}
                subDir={upperDir} 
                onDirUpdated={refreshDirectory}
                onDrop={(e) => handleDropToDirectory(e, upperDir.path)}
              />}
            {subDirs && subDirs.length > 0 && (
              <>
                {subDirs.map((subDir) => (
                  <SubGroupItem 
                    key={subDir.path}
                    label={subDir.path.split('/')[subDir.path.split('/').length - 2]}
                    subDir={subDir} 
                    onDirUpdated={refreshDirectory}
                    onDrop={(e) => handleDropToDirectory(e, subDir.path)}
                  />
                ))}
            </>
          )}
            </div>
        </div>

      {/* 이미지 섹션 */}
      {images && images.length > 0 && (
        <div className="section">
          <h3 className="section-title">
            이미지 ({images.length}개)
            {totalPages > 1 && (
              <span className="page-info">
                - 페이지 {currentPage} / {totalPages}
              </span>
            )}
          </h3>
          <div className="grid-container">
            {currentImages.map((image) => (
              <ImageIcon key={image.id} image={image} />
            ))}
          </div>
          
          {/* 페이지네이션 컨트롤 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                이전
              </button>
              
              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button 
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 키워드 시각화 컴포넌트 */}
      <KeywordVisualizer 
        imageKeywords={imageKeywords}
        onSelect={(keyword) => {
          if (userPrompt.length > 0) {
            setUserPrompt(userPrompt + ', ' + keyword);
          } else {
            setUserPrompt(keyword);
          }
        }}
      />


      {/* 빈 상태 메시지 */}
      {(!subDirs || subDirs.length === 0) && (!images || images.length === 0) && (
        <div className="empty-state">
          <p>표시할 폴더나 이미지가 없습니다.</p>
        </div>
      )}

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
            onClick={(e) => {e.preventDefault(); e.stopPropagation(); handleContextMenuAction('createSubGroup')}}
          >
            새 폴더 생성
          </div>
          {images && images.length > 0 && (
            <div 
              className="context-menu-item"
              onClick={(e) => {e.preventDefault(); e.stopPropagation(); handleContextMenuAction('selectAllImages')}}
            >
              모든 이미지 선택
            </div>
          )}
          {selectedImageIds.size > 0 && (
            <div 
              className="context-menu-item"
              onClick={(e) => {e.preventDefault(); e.stopPropagation(); handleContextMenuAction('deleteSelected')}}
            >
              선택된 이미지 삭제
            </div>
          )}
        </div>
      )}


      {/* 새 폴더 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 폴더 생성</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
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
                placeholder="폴더 이름을 입력하세요"
                className="group-name-input"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                취소
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleCreateDirectory}
                disabled={!newDirPath.trim()}
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


