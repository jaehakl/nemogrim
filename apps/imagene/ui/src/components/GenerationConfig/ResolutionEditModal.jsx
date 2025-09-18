import React, { useState, useEffect } from 'react';
import './ResolutionEditModal.css';

const ResolutionEditModal = ({ isOpen, onClose, onSave, onDelete, resolution, index }) => {
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(1024);

  useEffect(() => {
    if (resolution) {
      setWidth(resolution[0]);
      setHeight(resolution[1]);
    }
  }, [resolution]);

  const handleSave = () => {
    if (width >= 64 && width <= 2048 && height >= 64 && height <= 2048) {
      onSave(index, [width, height]);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(index);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>해상도 편집</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="resolution-inputs">
            <div className="input-group">
              <label>너비:</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 768)}
                min="64"
                max="2048"
              />
            </div>
            <div className="input-group">
              <label>높이:</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                min="64"
                max="2048"
              />
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="delete-btn" onClick={handleDelete}>
            삭제
          </button>
          <div className="action-buttons">
            <button className="cancel-btn" onClick={onClose}>
              취소
            </button>
            <button className="save-btn" onClick={handleSave}>
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResolutionEditModal;
