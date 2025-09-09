import React, { useState, useEffect } from 'react';
import { getUserTextList, deleteUserText } from '../api/api';
import './LoadTextModal.css';

const LoadTextModal = ({ isOpen, onClose, onLoadText }) => {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTextList();
    }
  }, [isOpen]);

  const loadTextList = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await getUserTextList();
      setTexts(response.data.user_texts || []);
    } catch (err) {
      if (err.response.status === 401) {
        setError('로그인 후 이용해주세요.');
      } else {
        setError('텍스트 목록을 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelect = (textData) => {
    onLoadText(textData);
    onClose();
  };

  const handleDeleteText = async (textId, event) => {
    event.stopPropagation(); // 텍스트 선택 이벤트 방지
    
    if (window.confirm('이 텍스트를 삭제하시겠습니까?')) {
      try {
        await deleteUserText(textId);
        // 삭제 후 목록 다시 로드
        await loadTextList();
      } catch (err) {
        console.error('텍스트 삭제 오류:', err);
        alert('텍스트 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content load-modal">
        <div className="modal-header">
          <h2>저장된 텍스트 불러오기</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="text-list-container">
          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : texts.length === 0 ? (
            <div className="no-texts">저장된 텍스트가 없습니다.</div>
          ) : (
            <div className="texts-list">
              {texts.map((textData, index) => (
                <div
                  key={index}
                  className="text-item"
                  onClick={() => handleTextSelect(textData)}
                >
                  <div className="text-content">
                    <div className="text-title">{textData.title}</div>
                    {textData.tags && (
                      <div className="text-tags">
                        {textData.tags.split(',').map((tag, tagIndex) => (
                          <span key={tagIndex} className="tag">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-preview">
                      {textData.user_text?.substring(0, 100)}
                      {textData.user_text?.length > 100 && '...'}
                    </div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteText(textData.id, e)}
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="close-modal-btn">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadTextModal;
