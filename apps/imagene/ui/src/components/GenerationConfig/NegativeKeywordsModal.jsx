import React, { useState, useEffect } from 'react';
import './NegativeKeywordsModal.css';

const NegativeKeywordsModal = ({ isOpen, onClose, onSave, negativeKeywords }) => {
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    if (negativeKeywords) {
      setKeywords(negativeKeywords);
    }
  }, [negativeKeywords]);

  const handleSave = () => {
    onSave(keywords.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>부정 키워드 편집</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="keywords-input-group">
            <label>부정 키워드:</label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="부정 키워드를 쉼표로 구분하여 입력하세요"
              rows="8"
              className="keywords-textarea"
            />
            <div className="keywords-info">
              <small>쉼표(,)로 구분하여 여러 키워드를 입력할 수 있습니다.</small>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
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

export default NegativeKeywordsModal;
