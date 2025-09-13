import React, { useState, useMemo } from 'react';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import './CustomTagPicker.css';

export const CustomTagPicker = ({ 
  placeholder = "키워드 선택",
  searchable = true 
}) => {
  const {
    keywordsByKey,
    selectedKeywords,
    setSelectedKeywords,
    bulkDeleteKeywords,
  } = useImageFilter();

  const [searchTerm, setSearchTerm] = useState('');
  const [threshold, setThreshold] = useState(0.5);




  // 검색 필터링
  const filteredGroups = React.useMemo(() => {
    if (!searchTerm) return keywordsByKey;
    
    const filtered = {};
    Object.entries(keywordsByKey).forEach(([key, items]) => {
      const filteredItems = items.filter(item => 
        item.item_value.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filteredItems.length > 0) {
        filtered[key] = filteredItems;
      }
    });
    return filtered;
  }, [keywordsByKey, searchTerm]);

  // 선택된 값 토글
  const toggleValue = (item) => {
    const current = Object.keys(selectedKeywords).length > 0 ? selectedKeywords : {};    
    const image_keyword_data = {
      key: item.key,
      value: item.value,
      direction: item.direction,
    }    
    if (current[item.id]) {
      const { [item.id]: removed, ...newValues } = current;
      setSelectedKeywords(newValues);
    } else {
      // 존재하지 않으면 추가
      const newValues = { ...current, [item.id]: image_keyword_data };
      setSelectedKeywords(newValues);
    }
  };

  // del_rate에 따른 배경색 계산
  const getBackgroundColor = (choiceRate) => {
    if (choiceRate === undefined || choiceRate === null) return '#fff';
    
    // choice_rate를 0~100 범위로 정규화 (0이 가장 어둡고, 100이 가장 밝게)
    const lightness = Math.max(Math.min(choiceRate, threshold), 0)*100/threshold;    
    return `hsl(0, 0%, ${lightness}%)`;
  };

  // del_rate에 따른 텍스트 색상 계산
  const getTextColor = (choiceRate) => {
    if (choiceRate === undefined || choiceRate === null) return '#222';
    
    const lightness = Math.max(Math.min(choiceRate, threshold), 0)*100/threshold;    
    
    // 어두운 배경일 때는 밝은 텍스트, 밝은 배경일 때는 어두운 텍스트
    return lightness > 50 ? '#000' : '#fff';
  };

  // (1 - del_rate) 확률로 무작위 토글
  const randomToggleByProbability = () => {
    const current = (selectedKeywords) ? selectedKeywords : {};
    const newValues = { ...current };
    
    // 모든 아이템에 대해 확률적으로 토글
    Object.values(filteredGroups).forEach(items => {
      Object.values(items).forEach(item => {
        if (item.choice_rate !== undefined && item.choice_rate !== null) {
          console.log(item.choice_rate);
          const probability = item.choice_rate;
          const randomValue = Math.random();

          if (randomValue < probability) {
            // 확률에 따라 토글
            if (newValues[item.id]) {
              // 이미 선택된 경우 제거
              delete newValues[item.id];
            } else {
              // 선택되지 않은 경우 추가
              newValues[item.id] = item;
            }
          }
        }
      });
    });
    console.log(newValues);
    setSelectedKeywords(newValues);
  };

  return (
    <div className="custom-tag-picker">
      {searchable && (
        <div className="custom-tag-picker-search">
          <input
            type="text"
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="custom-tag-picker-search-input"
          />
        </div>
      )}
      
      <div className="custom-tag-picker-controls">
        <div className="custom-tag-picker-threshold-control">
          <label className="custom-tag-picker-threshold-label">
            임계값: {threshold.toFixed(2)}
          </label>
          <div className="custom-tag-picker-slider-container">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="custom-tag-picker-slider"
            />
            <div className="custom-tag-picker-slider-labels">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>
        </div>        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="custom-tag-picker-random-btn"
            onClick={randomToggleByProbability}
            title="del_rate 확률로 무작위 토글"
          >
            🎲 무작위 선택
          </button>          
          <button
            className="custom-tag-picker-random-btn"
            onClick={() => setSelectedKeywords({})}
            title="모든 선택 해제"
          >
            🗑️ 초기화
          </button>
          <button
            className="custom-tag-picker-random-btn"
            onClick={bulkDeleteKeywords}
            title="모든 선택 삭제"
          >
            🗑️ 삭제
          </button>
        </div>
      </div>
      
      <div className="custom-tag-picker-content">
        {Object.entries(filteredGroups).map(([key, items]) => (
          <div key={key} className="custom-tag-picker-group">
            <div className="custom-tag-picker-group-header">{key}</div>
            <div className="custom-tag-picker-group-items">
              {Object.entries(items).map(([key, item], index) => {
                const isSelected = selectedKeywords && selectedKeywords[item.id];
                const backgroundColor = isSelected ? '#e6f7ff' : getBackgroundColor(item.choice_rate);
                const textColor = isSelected ? '#1890ff' : getTextColor(item.choice_rate);
                
                return (
                  <button
                    key={`${key}-${index}`}
                    className={`custom-tag-picker-option ${
                      isSelected ? 'selected' : ''
                    }`}
                    style={{
                      backgroundColor: backgroundColor,
                      color: textColor,
                      borderColor: isSelected ? '#40a9ff' : '#d9d9d9'
                    }}
                    onClick={() => toggleValue(item)}
                  >
                    <span className="custom-tag-picker-option-value" style={{ color: textColor }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
