import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './WordsHighlighter.css';
import { createWordsPersonal, deleteWordsBatch } from '../api/api';
import WordInputModal from './WordInputModal';


const WordsHighlighter = ({words}) => {
  const [tooltip, setTooltip] = useState({ show: false, data: null, position: { x: 0, y: 0 } });  
  const [showModal, setShowModal] = useState(false);
  const [selectedWord, setSelectedWord] = useState(null);

  // 툴팁 표시
  const handleMouseEnter = (word, event) => {
    const x = Math.min(Math.max(event.clientX, 8), window.innerWidth - 8);
    const y = Math.min(Math.max(event.clientY - 16, 8), window.innerHeight - 8);
    setTooltip({
      show: true,
      data: word,
      position: {
        x: x,
        y: y
      }
    });
  };

  // 마우스 이동 시 위치 업데이트
  const handleMouseMove = (word, event) => {
    const x = Math.min(Math.max(event.clientX, 8), window.innerWidth - 8);
    const y = Math.min(Math.max(event.clientY - 16, 8), window.innerHeight - 8);
    setTooltip({
      show: true,
      data: word,
      position: {
        x: x,
        y: y-130
      }
    });
  };

  // 툴팁 숨김
  const handleMouseLeave = () => {
    setTooltip({ show: false, data: null, position: { x: 0, y: 0 } });
  };

  // 모달 열기
  const handleWordClick = (word) => {
    setSelectedWord(word);
    setTooltip({ show: false, data: null, position: { x: 0, y: 0 } });
    setShowModal(true);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedWord(null);
  };

  // 단어 삭제
  const handleDeleteWord = async (wordId) => {
    try {
      const response = await deleteWordsBatch([wordId]);
      if (response.status === 200) {
        alert('단어가 성공적으로 삭제되었습니다.');
      }
    } catch (error) {
      console.error('단어 삭제 오류:', error);
      alert('단어 삭제 중 오류가 발생했습니다.');
    }
  };

  // 단어 추가/수정
  const handleAddWord = async (formData) => {
    try {
      // FormData에서 데이터 추출
      const response = await createWordsPersonal(formData);      
    } catch (error) {
      console.error('FormData 파싱 오류:', error);
      alert('데이터 처리 중 오류가 발생했습니다.');
    }
  };

  // 강조 표시된 텍스트 렌더링
  const renderHighlightedText = () => {
    if (!words) return null;
    const elements = [];
    for (let i_line in words) {
      for (let i_word in words[i_line]) {
        if (words[i_line][i_word].word_id && !words[i_line][i_word].user_word_skills.some(skill => skill.reading > 80)) {
        elements.push(
          <span
            key={`morpheme-${i_line}-${i_word}`}
            className={`morpheme morpheme-${words[i_line][i_word].level}`}
            onMouseEnter={(e) => handleMouseEnter(words[i_line][i_word], e)}
            onMouseMove={(e) => handleMouseMove(words[i_line][i_word], e)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleWordClick(words[i_line][i_word])}
            >
            {words[i_line][i_word].surface}
          </span>
        );
        } else {
          elements.push(
            <span
              key={`morpheme-${i_line}-${i_word}`}
              className={`morpheme morpheme-N\/A`}
              onMouseEnter={(e) => handleMouseEnter(words[i_line][i_word], e)}
              onMouseMove={(e) => handleMouseMove(words[i_line][i_word], e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleWordClick(words[i_line][i_word])}
            >
              {words[i_line][i_word].surface}
            </span>
          );
        }
      }
      elements.push(
        <span key={`text-${i_line}-br`}>
          <br />
        </span>
      );
    }
    return elements;
  };

  return (
    <div className="words-highlighter-container">
        <div className="highlighted-text">
            {renderHighlightedText()}
        </div>      
        
        {/* 커스텀 툴팁 (포탈로 body에 렌더링) */}
        {tooltip.show && tooltip.data && createPortal(
          (
            <div 
              className="custom-tooltip"
              style={{
                left: tooltip.position.x,
                top: tooltip.position.y,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="tooltip-header">
                <span className="tooltip-surface">{tooltip.data.lemma}</span>
                <span className="tooltip-level">{tooltip.data.level}</span>
                <span className="tooltip-level">{tooltip.data.user_display_name}</span>
              </div>
              <div className="tooltip-content">
                <div className="tooltip-row">
                  <span className="tooltip-label">일본어 발음:</span>
                  <span className="tooltip-value">{tooltip.data.jp_pron || '-'}</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">한국어 발음:</span>
                  <span className="tooltip-value">{tooltip.data.kr_pron || '-'}</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">한국어 뜻:</span>
                  <span className="tooltip-value">{tooltip.data.kr_mean || '-'}</span>
                </div>
              </div>
            </div>
          ),
          document.body
        )}


      {/* 단어 입력 모달 */}
      <WordInputModal
        word={selectedWord}
        isOpen={showModal}
        onClose={handleCloseModal}
        onSubmit={handleAddWord}
        onDelete={handleDeleteWord}
      />

     </div>
  );
};

export default WordsHighlighter;
