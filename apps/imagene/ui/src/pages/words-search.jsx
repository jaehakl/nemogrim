import React, { useState } from 'react';
import { searchWordsByWord } from '../api/api';
import { to_hiragana } from '../service/hangul-to-hiragana';
import './WordsSearch.css';

const WordsSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermHiragana, setSearchTermHiragana] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchTermHiragana.trim()) {
      setError('검색어를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const response = await searchWordsByWord(searchTerm+','+searchTermHiragana);
      setSearchResults(response.data);
    } catch (err) {
      console.error('검색 중 오류 발생:', err);
      setError('검색 중 오류가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
    setSearchTerm(e.target.value);
    setSearchTermHiragana(to_hiragana(e.target.value));
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setError('');
  };

  return (
    <div className="words-search-container">
      <div className="search-header">
        <h1>단어 검색</h1>
        <p>일본어 단어, 발음, 의미로 검색할 수 있습니다.</p>
      </div>
      <div className="search-section">
        <div className="search-input-group">        
          <input
            type="text"
            value={searchTerm}
            onChange={handleChange}
            placeholder="검색어를 입력하세요 (일본어, 발음, 의미)"
            className="search-input"
          />
          {searchTermHiragana}
          <div className="search-buttons">
            <button 
              onClick={handleSearch} 
              disabled={isLoading}
              className="search-button"
            >
              {isLoading ? '검색 중...' : '검색'}
            </button>
            <button 
              onClick={clearSearch} 
              className="clear-button"
            >
              초기화
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>

      <div className="results-section">
        {searchResults.length > 0 && (
          <div className="results-info">
            <h2>검색 결과 ({searchResults.length}개)</h2>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="results-table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>단어 원형</th>
                  <th>일본어 발음</th>
                  <th>한글 발음</th>
                  <th>한글 의미</th>
                  <th>레벨</th>
                  <th>수정일</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((word) => (
                  <tr key={word.id}>
                    <td className="word-cell">{word.lemma}</td>
                    <td className="pronunciation-cell">{word.jp_pron}</td>
                    <td className="pronunciation-cell">{word.kr_pron}</td>
                    <td className="meaning-cell">{word.kr_mean}</td>
                    <td className="level-cell">{word.level}</td>
                    <td className="date-cell">{new Date(word.updated_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && searchTerm && searchResults.length === 0 && !error && (
          <div className="no-results">
            <p>검색 결과가 없습니다.</p>
            <p>다른 검색어를 시도해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordsSearch;
