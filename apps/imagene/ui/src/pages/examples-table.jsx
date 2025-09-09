import React, { useState, useEffect } from 'react';
import EditableTable from '../components/EditableTable';
import FilterInput from '../components/FilterInput';
import { filterExamples, updateExamplesBatch, deleteExamplesBatch } from '../api/api';
import './ExamplesTable.css';

 // 필터 설정
 const FILTER_CONFIG = {
  sections: [
    {
      type: 'range',
      key: 'words',
      label: '단어 수',
      minKey: 'min_words',
      maxKey: 'max_words',
      minLabel: '최소',
      maxLabel: '최대',
      minDefault: '',
      maxDefault: ''
    },
    {
      type: 'select',
      key: 'has_en_prompt',
      label: '프롬프트 보유 여부',
      defaultValue: null
    },
    {
      type: 'select',
      key: 'has_audio',
      label: '음성 보유 여부',
      defaultValue: null
    },
    {
      type: 'select',
      key: 'has_image',
      label: '이미지 보유 여부',
      defaultValue: null
    },
    {
      type: 'select',
      key: 'has_embedding',
      label: '임베딩 보유 여부',
      defaultValue: null
    }
  ]
};

const ExamplesTable = () => {
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // 컬럼 정의
  const columns = [
    { key: 'tags', label: '태그', editable: true },
    { key: 'jp_text', label: '일본어 예문', editable: true },
    { key: 'kr_mean', label: '한국어 의미', editable: true },
    { key: 'en_prompt', label: '프롬프트', editable: true },
    { key: 'has_embedding', label: '임베딩 보유', editable: false },
    { key: 'has_audio', label: '음성 보유', editable: false },
    { key: 'has_image', label: '이미지 보유', editable: false },
    { key: 'num_words', label: '단어 수', editable: false },
  ];

  // Examples 데이터 불러오기
  const handleFilter = async (filterData) => {
    setLoading(true);
    setError(null);
    
    try {
      // 필터 데이터 정리
      const cleanFilterData = {
        ...filterData,
        min_words: filterData.min_words ? parseInt(filterData.min_words) : null,
        max_words: filterData.max_words ? parseInt(filterData.max_words) : null,
        has_en_prompt: filterData.has_en_prompt,
        has_embedding: filterData.has_embedding,
        has_audio: filterData.has_audio,
        has_image: filterData.has_image,
        limit: filterData.limit,
        offset: filterData.offset || 0
      };

      const response = await filterExamples(cleanFilterData);
      setExamples(response.data.examples || []);
      setTotalCount(response.data.total_count || 0);
    } catch (err) {
      setError('필터링 중 오류가 발생했습니다: ' + (err.response?.data?.detail || err.message));
      setExamples([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 변경 처리
  const handleDataChange = (newData) => {
    setExamples(newData);
  };

  // 선택된 행들 일괄 수정
  const handleBatchUpdate = async (examplesToUpdate) => {
    if (!examplesToUpdate || examplesToUpdate.length === 0) {
      alert('수정할 예문이 없습니다.');
      return;
    }

    const processedExamples = examplesToUpdate.map(example => {
        return {
          id: example.id,
          tags: example.tags,
          jp_text: example.jp_text,
          kr_mean: example.kr_mean,
          en_prompt: example.en_prompt,
        };
      });

    try {
      await updateExamplesBatch(processedExamples);
      alert('예문들이 성공적으로 수정되었습니다.');
    } catch (err) {
      console.error('일괄 수정 실패:', err);
      alert('수정에 실패했습니다.');
    }
  };

  // 선택된 행들 일괄 삭제
  const handleBatchDelete = async (exampleIds) => {
    console.log(exampleIds);
    if (!exampleIds || exampleIds.length === 0) {
      alert('삭제할 예문이 없습니다.');
      return;
    }

    if (!confirm(`선택된 ${exampleIds.length}개의 예문을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteExamplesBatch(exampleIds);
      alert('선택된 예문들이 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error('일괄 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="examples-table-page">
      <div className="page-header">
        <h1>예문 관리</h1>
      </div>

      {/* 필터 조건 입력 폼 */}
      <FilterInput
        filterConfig={FILTER_CONFIG}
        onSubmit={handleFilter}
        //onFilterChange={handleFilter}
        loading={loading}
        totalCount={totalCount}
        showPagination={true}
        showFilterButton={true}
        showResetButton={false}
        limit={100}
      />

      <div className="table-section">
        <EditableTable
          columns={columns}
          data={examples}
          onDataChange={handleDataChange}
          onUpdate={handleBatchUpdate}
          onDelete={handleBatchDelete}
          showAddRow={false}
          showPasteButton={false}
          showCopyButton={true}
        />
      </div>

      <div className="page-footer">
        <p>현재 페이지: {examples.length}개의 예문이 표시됩니다.</p>
      </div>
    </div>
  );
};

export default ExamplesTable;
