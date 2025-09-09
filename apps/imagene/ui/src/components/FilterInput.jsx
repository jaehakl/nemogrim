import React, { useState, useEffect } from 'react';
import './FilterInput.css';

const FilterInput = ({ 
  filterConfig, 
  onSubmit, 
  onReset, 
  onFilterChange,
  loading = false,
  totalCount = 0,
  showPagination = true,
  showFilterButton = true,
  showResetButton = true,
  limit = 100
}) => {
  // 기본값 생성 함수
  const getDefaultValues = () => {
    const defaults = {};
    filterConfig.sections.forEach(section => {
      switch (section.type) {
        case 'checkbox-group':
          defaults[section.key] = section.defaultValue || [];
          break;
        case 'range':
          defaults[section.minKey] = section.minDefault || '';
          defaults[section.maxKey] = section.maxDefault || '';
          break;
        case 'select':
          defaults[section.key] = section.defaultValue !== undefined ? section.defaultValue : null;
          break;
        case 'number':
          defaults[section.key] = section.defaultValue || 100;
          break;
        default:
          break;
      }
    });
    return defaults;
  };

  // 내부 상태로 filterData 관리
  const [filterData, setFilterData] = useState(getDefaultValues());
  const [offset, setOffset] = useState(0);
  const [selectedLimit, setSelectedLimit] = useState(limit);

  // filterConfig가 변경될 때 기본값 재설정
  useEffect(() => {
    setFilterData(getDefaultValues());
  }, [filterConfig]);


  useEffect(() => {
    if (onFilterChange) {
      setOffset(0);
      onFilterChange({ ...filterData, offset: 0, limit: selectedLimit });
    }
  }, [filterData, selectedLimit]);

  // 필터 조건 변경 핸들러
  const handleFilterChange = (field, value) => {
    setFilterData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 레벨 선택/해제 핸들러 (체크박스 타입용)
  const handleLevelToggle = (level) => {
    const currentLevels = filterData.levels || [];
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level];
    handleFilterChange('levels', newLevels);
  };

  // 필터링 실행
  const handleSubmit = () => {
    setOffset(0); // 필터링 시 offset 초기화
    onSubmit({ ...filterData, offset: 0, limit: selectedLimit });
  };

  // 필터 초기화
  const handleReset = () => {
    const defaultValues = getDefaultValues();
    setFilterData(defaultValues);
    setOffset(0);
    onReset(defaultValues);
  };

  // 페이지네이션 핸들러
  const handlePageChange = (newOffset) => {
    setOffset(newOffset);
    onSubmit({ ...filterData, offset: newOffset, limit: selectedLimit });
  };

  // 페이지 번호 계산
  const getCurrentPage = () => Math.floor(offset / selectedLimit) + 1;
  const getTotalPages = () => Math.ceil(totalCount / selectedLimit);

  // 페이지네이션 버튼 생성
  const generatePageButtons = () => {
    const currentPage = getCurrentPage();
    const totalPages = getTotalPages();
    
    if (totalPages <= 1) return [];

    const buttons = [];
    const maxVisiblePages = 7; // 최대 표시할 페이지 수
    
    let startPage, endPage;
    
    if (totalPages <= maxVisiblePages) {
      // 전체 페이지가 적으면 모두 표시
      startPage = 1;
      endPage = totalPages;
    } else {
      // 현재 페이지를 중심으로 표시
      const halfVisible = Math.floor(maxVisiblePages / 2);
      
      if (currentPage <= halfVisible) {
        startPage = 1;
        endPage = maxVisiblePages;
      } else if (currentPage + halfVisible >= totalPages) {
        startPage = totalPages - maxVisiblePages + 1;
        endPage = totalPages;
      } else {
        startPage = currentPage - halfVisible;
        endPage = currentPage + halfVisible;
      }
    }

    // 첫 페이지와 생략 표시
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => handlePageChange(0)}
          className={`pagination-btn ${currentPage === 1 ? 'active' : ''}`}
        >
          1
        </button>
      );
      
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className="pagination-ellipsis">
            ...
          </span>
        );
      }
    }

    // 페이지 번호들
    for (let i = startPage; i <= endPage; i++) {
      if (i === 1 && startPage > 1) continue; // 이미 추가된 첫 페이지 제외
      
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange((i - 1) * selectedLimit)}
          className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    // 마지막 페이지와 생략 표시
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis2" className="pagination-ellipsis">
            ...
          </span>
        );
      }
      
      buttons.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange((totalPages - 1) * selectedLimit)}
          className={`pagination-btn ${currentPage === totalPages ? 'active' : ''}`}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  // 필터 섹션 렌더링
  const renderFilterSection = (section) => {
    switch (section.type) {
      case 'checkbox-group':
        return (
          <div key={section.key} className="filter-section">
            <h3>{section.label}</h3>
            <div className="level-checkboxes">
              {section.options.map(option => (
                <label key={option} className="level-checkbox">
                  <input
                    type="checkbox"
                    checked={(filterData[section.key] || []).includes(option)}
                    onChange={() => handleLevelToggle(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        );

      case 'range':
        return (
          <div key={section.key} className="filter-section">
            <h3>{section.label}</h3>
            <div className="range-inputs">
              <input
                type="number"
                placeholder={section.minLabel || "최소"}
                value={filterData[section.minKey] || ''}
                onChange={(e) => handleFilterChange(section.minKey, e.target.value)}
                min="0"
              />
              <span>~</span>
              <input
                type="number"
                placeholder={section.maxLabel || "최대"}
                value={filterData[section.maxKey] || ''}
                onChange={(e) => handleFilterChange(section.maxKey, e.target.value)}
                min="0"
              />
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={section.key} className="filter-section">
            <h3>{section.label}</h3>
            <select
              value={filterData[section.key] === null ? '' : filterData[section.key].toString()}
              onChange={(e) => handleFilterChange(section.key, e.target.value === '' ? null : e.target.value === 'true')}
            >
              <option value="">상관없음</option>
              <option value="true">보유</option>
              <option value="false">미보유</option>
            </select>
          </div>
        );

      case 'number':
        return (
          <div key={section.key} className="filter-section">
            <h3>{section.label}</h3>
            <input
              type="number"
              value={filterData[section.key] || section.defaultValue || 100}
              onChange={(e) => handleFilterChange(section.key, parseInt(e.target.value) || section.defaultValue || 100)}
              min={section.min || 1}
              max={section.max || 1000}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // limit 변경 핸들러
  const handleLimitChange = (newLimit) => {
    setSelectedLimit(newLimit);
    setOffset(0); // limit 변경 시 첫 페이지로 이동
  };

  return (
    <div className="filter-form">
      {filterConfig.sections.map(renderFilterSection)}
      
      {/* Limit 선택 버튼 */}
      <div className="filter-section">
        <h3>페이지당 항목 수</h3>
        <div className="limit-buttons">
          {[20, 100, 1000].map(limitOption => (
            <button
              key={limitOption}
              onClick={() => handleLimitChange(limitOption)}
              className={`limit-btn ${selectedLimit === limitOption ? 'active' : ''}`}
            >
              {limitOption}개
            </button>
          ))}
        </div>
      </div>
      
      <div className="filter-actions">
        {showFilterButton && <button 
          onClick={handleSubmit} 
          disabled={loading} 
          className="filter-btn"
        >
          {loading ? '필터링 중...' : '필터링 실행'}
        </button>}
        {showResetButton && <button 
          onClick={handleReset} 
          className="reset-btn"
        >
          초기화
        </button>}
      </div>

      {/* 페이지네이션 */}
      {showPagination && totalCount > 0 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(0)}
            disabled={offset === 0}
            className="pagination-btn"
          >
            처음
          </button>
          <button
            onClick={() => handlePageChange(Math.max(0, offset - selectedLimit))}
            disabled={offset === 0}
            className="pagination-btn"
          >
            이전
          </button>
          
          {generatePageButtons()}
          
          <button
            onClick={() => handlePageChange(offset + selectedLimit)}
            disabled={offset + selectedLimit >= totalCount}
            className="pagination-btn"
          >
            다음
          </button>
          <button
            onClick={() => handlePageChange((getTotalPages() - 1) * selectedLimit)}
            disabled={offset + selectedLimit >= totalCount}
            className="pagination-btn"
          >
            마지막
          </button>
          
          <span className="pagination-info">
            페이지 {getCurrentPage()} / {getTotalPages()} 
            ({(offset + 1)}-{Math.min(offset + selectedLimit, totalCount)} / {totalCount})
          </span>
        </div>
      )}
    </div>
  );
};

export default FilterInput;
