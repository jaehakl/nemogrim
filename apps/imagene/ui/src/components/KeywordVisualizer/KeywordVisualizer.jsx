import React from 'react';
import './KeywordVisualizer.css';

export const KeywordVisualizer = ({ imageKeywords, onSelect }) => {
  if (!imageKeywords || Object.keys(imageKeywords).length === 0) {
    return (
      <div className="keyword-visualizer">
        <div className="no-keywords">표시할 키워드가 없습니다.</div>
      </div>
    );
  }

  // 키워드를 빈도수로 정렬하고, 같은 빈도수는 알파벳 순으로 정렬
  const sortedKeywords = Object.entries(imageKeywords)
    .sort(([a, aCount], [b, bCount]) => {
      if (bCount !== aCount) {
        return bCount - aCount; // 빈도수 내림차순
      }
      return a.localeCompare(b); // 알파벳 오름차순
    });

  const getFrequencyClass = (intensity) => {
    if (intensity >= 0.25) return 'frequency-high';
    if (intensity >= 0.1) return 'frequency-medium-high';
    if (intensity >= 0.05) return 'frequency-medium';
    if (intensity >= 0.01) return 'frequency-low';
    return 'frequency-very-low';
  };

  return (
    <div className="keyword-visualizer">
      <h3 className="keyword-title">키워드 분석</h3>
      <div className="keyword-container">
        {sortedKeywords.map(([keyword, intensity]) => (
          <button
            key={keyword}
            className={`keyword-tag ${getFrequencyClass(intensity)}`}
            onClick={() => onSelect && onSelect(keyword)}
            title={`${keyword}: ${intensity}`}
          >
            <span className="keyword-text">{keyword}</span>
            <span className="keyword-count">{intensity.toFixed(3)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
