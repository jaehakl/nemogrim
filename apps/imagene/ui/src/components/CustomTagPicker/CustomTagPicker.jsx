import React, { useState } from 'react';
import './CustomTagPicker.css';

export const CustomTagPicker = ({ 
  data = [], 
  value = [], 
  onChange, 
  placeholder = "키워드 선택",
  searchable = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 키별로 그룹화된 데이터 생성
  const groupedData = React.useMemo(() => {
    const groups = {};
    data.forEach(item => {
      const key = item.value.split(':')[0];
      const label = item.label;
      const item_value = item.value;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({ ...item, key, label, item_value});
    });
    return groups;
  }, [data]);

  // 검색 필터링
  const filteredGroups = React.useMemo(() => {
    if (!searchTerm) return groupedData;
    
    const filtered = {};
    Object.entries(groupedData).forEach(([key, items]) => {
      const filteredItems = items.filter(item => 
        item.item_value.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filteredItems.length > 0) {
        filtered[key] = filteredItems;
      }
    });
    return filtered;
  }, [groupedData, searchTerm]);

  // 선택된 값 토글
  const toggleValue = (itemValue) => {
    const current = Array.isArray(value) ? value : [];
    const newValues = current.includes(itemValue)
      ? current.filter(v => v !== itemValue)
      : [...current, itemValue];
    onChange?.(newValues);
  };

  // del_rate에 따른 배경색 계산
  const getBackgroundColor = (delRate) => {
    if (delRate === undefined || delRate === null) return '#fff';
    
    // del_rate를 0.8-1 범위로 정규화 (0이 가장 밝고, 1이 가장 어둡게)
    const normalizedRate = Math.min(Math.max(delRate, 0.92), 1);
    
    // 밝은 회색에서 어두운 회색으로 그라데이션
    const lightness = 100 - ((normalizedRate - 0.92) * 1250); // 0%에서 100%까지
    return `hsl(0, 0%, ${lightness}%)`;
  };

  // del_rate에 따른 텍스트 색상 계산
  const getTextColor = (delRate) => {
    if (delRate === undefined || delRate === null) return '#222';
    
    const normalizedRate = Math.min(Math.max(delRate, 0.92), 1);
    
    // 어두운 배경일 때는 밝은 텍스트, 밝은 배경일 때는 어두운 텍스트
    return normalizedRate > 0.92 ? '#fff' : '#222';
  };

  // (1 - del_rate) 확률로 무작위 토글
  const randomToggleByProbability = () => {
    const current = Array.isArray(value) ? value : [];
    const newValues = [...current];
    
    // 모든 아이템에 대해 확률적으로 토글
    Object.values(filteredGroups).forEach(items => {
      items.forEach(item => {
        if (item.del_rate !== undefined && item.del_rate !== null) {
          const probability = 1 - item.del_rate; // (1 - del_rate)를 확률로 사용
          const randomValue = Math.random();
          
          if (randomValue < probability) {
            // 확률에 따라 토글
            if (newValues.includes(item.item_value)) {
              // 이미 선택된 경우 제거
              const index = newValues.indexOf(item.item_value);
              newValues.splice(index, 1);
            } else {
              // 선택되지 않은 경우 추가
              newValues.push(item.item_value);
            }
          }
        }
      });
    });
    
    onChange?.(newValues);
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
        <button
          className="custom-tag-picker-random-btn"
          onClick={randomToggleByProbability}
          title="del_rate 확률로 무작위 토글"
        >
          🎲 무작위 선택
        </button>
      </div>
      
      <div className="custom-tag-picker-content">
        {Object.entries(filteredGroups).map(([key, items]) => (
          <div key={key} className="custom-tag-picker-group">
            <div className="custom-tag-picker-group-header">{key}</div>
            <div className="custom-tag-picker-group-items">
              {items.map((item, index) => {
                const isSelected = Array.isArray(value) && value.includes(item.item_value);
                const backgroundColor = isSelected ? '#e6f7ff' : getBackgroundColor(item.del_rate);
                const textColor = isSelected ? '#1890ff' : getTextColor(item.del_rate);
                
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
                    onClick={() => toggleValue(item.item_value)}
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
