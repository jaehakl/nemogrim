import React, { useState, useEffect } from 'react';
import EditableTable from '../components/EditableTable';
import FilterInput from '../components/FilterInput';
import { filterWords, updateWordsBatch, deleteWordsBatch } from '../api/api';
import './WordsTable.css';


 // 필터 설정
const FILTER_CONFIG = {
  sections: [
    {
      type: 'checkbox-group',
      key: 'levels',
      label: '레벨 선택',
      options: ['N5', 'N4', 'N3', 'N2', 'N1'],
      defaultValue: []
    },
    {
      type: 'range',
      key: 'examples',
      label: '예문 수',
      minKey: 'min_examples',
      maxKey: 'max_examples',
      minLabel: '최소',
      maxLabel: '최대',
      minDefault: '',
      maxDefault: ''
    },
    {
      type: 'select',
      key: 'has_embedding',
      label: 'Embedding 보유 여부',
      defaultValue: null
    },
  ]
};

const WordsTable = () => {

  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // 컬럼 정의
  const columns = [
    { key: 'lemma_id', label: '원형 ID', editable: false },
    { key: 'lemma', label: '원형', editable: true },
    { key: 'jp_pron', label: '발음', editable: true },
    { key: 'kr_pron', label: '한글', editable: true },
    { key: 'kr_mean', label: '의미', editable: true },
    { key: 'level', label: '레벨', editable: true },
    { key: 'num_examples', label: '예문', editable: false },    
  ];

  // 필터링 실행
  const handleFilter = async (filterData) => {
    setLoading(true);
    setError(null);
    
    try {
      // 필터 데이터 정리
      const cleanFilterData = {
        ...filterData,
        levels: filterData.levels.length > 0 ? filterData.levels : null,
        min_examples: filterData.min_examples ? parseInt(filterData.min_examples) : null,
        max_examples: filterData.max_examples ? parseInt(filterData.max_examples) : null,
        limit: filterData.limit,
        offset: filterData.offset || 0
      };

      const response = await filterWords(cleanFilterData);
      setWords(response.data.words || []);
      setTotalCount(response.data.total_count || 0);
    } catch (err) {
      setError('필터링 중 오류가 발생했습니다: ' + (err.response?.data?.detail || err.message));
      setWords([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // 필터 초기화
  const handleReset = (defaultValues) => {
    setWords([]);
    setTotalCount(0);
    setError(null);
  };

  // 데이터 변경 처리
  const handleDataChange = (newData) => {
    setWords(newData);
  };

  // 선택된 행들 일괄 수정
  const handleBatchUpdate = async (wordsToUpdate) => {
    if (!wordsToUpdate || wordsToUpdate.length === 0) {
      alert('수정할 단어가 없습니다.');
      return;
    }
    try {
      await updateWordsBatch(wordsToUpdate);
      alert('단어들이 성공적으로 수정되었습니다.');
    } catch (err) {
      console.error('일괄 수정 실패:', err);
      alert('수정에 실패했습니다.');
    }
  };

  // 선택된 행들 일괄 삭제
  const handleBatchDelete = async (wordIds) => {
    if (!wordIds || wordIds.length === 0) {
      alert('삭제할 단어가 없습니다.');
      return;
    }

    if (!confirm(`선택된 ${wordIds.length}개의 단어를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteWordsBatch(wordIds);
      alert('선택된 단어들이 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error('일괄 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
    }
  };


  return (
    <div className="words-table-page">
      <div className="page-header">
        <h1>단어 관리</h1>
      </div>
        {/* 필터 조건 입력 폼 */}
        <FilterInput
            filterConfig={FILTER_CONFIG}
            onSubmit={handleFilter}
            onReset={handleReset}
            //onFilterChange={handleFilter}
            loading={loading}
            totalCount={totalCount}
            showPagination={true}
            showFilterButton={true}
            showResetButton={false}
            limit={10}
      />

      {/* 결과 정보 */}
      {totalCount > 0 && (
        <div className="result-info">
          <p>총 {totalCount}개의 단어가 검색되었습니다. (현재 {words.length}개 표시)</p>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="table-section">
        <EditableTable
          columns={columns}
          data={words}
          onDataChange={handleDataChange}
          onUpdate={handleBatchUpdate}
          onDelete={handleBatchDelete}
          showAddRow={false}
          showPasteButton={false}
          showCopyButton={true}
        />
      </div>

      <div className="page-footer">
        <p>현재 페이지: {words.length}개의 단어가 표시됩니다.</p>
      </div>
    </div>
  );
};

export default WordsTable;
