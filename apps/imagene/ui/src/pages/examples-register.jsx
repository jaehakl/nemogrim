import React, { useState, useEffect } from 'react';
import EditableTable from '../components/EditableTable';
import { createExamplesBatch } from '../api/api';
import './ExamplesRegister.css';

const ExamplesRegister = () => {
  const [examples, setExamples] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // 테이블 컬럼 정의 - DB의 실제 Examples 테이블 구조 반영
  const columns = [
    {
      key: 'tags',
      label: '태그'
    },
    {
      key: 'jp_text',
      label: '일본어 예문'
    },
    {
      key: 'kr_mean',
      label: '한국어 의미'
    },
    {
      key: 'en_prompt',
      label: '프롬프트'
    },
  ];

  // 데이터 변경 핸들러
  const handleDataChange = (newData) => {
    setExamples(newData);
  };

  // 예문 등록 처리
  const handleSubmit = async () => {
    if (examples.length === 0) {
      setMessage('등록할 예문이 없습니다.');
      return;
    }

    // 빈 행 필터링
    const validExamples = examples.filter(example => 
      example.tags && example.jp_text && example.kr_mean && example.en_prompt
    );

    if (validExamples.length === 0) {
      setMessage('모든 항목을 입력해주세요.');
      return;
    }

    const processedExamples = validExamples.map(example => {
      return {
        tags: example.tags,
        jp_text: example.jp_text,
        kr_mean: example.kr_mean,
        en_prompt: example.en_prompt,
      };
    });

    setIsSubmitting(true);
    setMessage('');

    try {
      // 백엔드가 기대하는 형식으로 데이터 전송 (examples 배열을 직접 전송)
      const response = await createExamplesBatch(processedExamples);
      
      if (response.status === 200 || response.status === 201) {
        setMessage(`${validExamples.length}개의 예문이 성공적으로 등록되었습니다.`);
        setExamples([]); // 테이블 초기화
      } else {
        setMessage('예문 등록에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Error submitting examples:', error);
      if (error.response) {
        // 서버 응답이 있는 경우
        if (error.response.status === 422) {
          setMessage('입력 데이터 형식이 잘못되었습니다. 모든 필수 필드를 올바르게 입력해주세요.');
        } else if (error.response.data && error.response.data.detail) {
          setMessage(`서버 오류: ${error.response.data.detail}`);
        } else {
          setMessage(`서버 오류 (${error.response.status}): 다시 시도해주세요.`);
        }
      } else {
        setMessage('서버 연결 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 테이블 초기화
  const handleClearTable = () => {
    if (examples.length > 0) {
      if (window.confirm('테이블의 모든 데이터를 삭제하시겠습니까?')) {
        setExamples([]);
        setMessage('');
      }
    }
  };

  return (
    <div className="examples-register-container">
      <div className="page-header">
        <h1>일본어 예문 등록</h1>
        <p>일본어 예문과 한국어 의미를 테이블에 입력하여 등록하세요.</p>
      </div>

      <div className="table-section">
        <div className="table-header">
          <h2>예문 목록</h2>
          <div className="table-actions">
            <button 
              onClick={handleClearTable} 
              className="clear-btn"
              disabled={examples.length === 0}
            >
              테이블 초기화
            </button>
          </div>
        </div>

        <EditableTable
          columns={columns}
          data={examples}
          onDataChange={handleDataChange}
          addRowText="예문 추가"
          showCopyButton={true}
        />

        <div className="submit-section">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || examples.length === 0}
            className="submit-btn"
          >
            {isSubmitting ? '등록 중...' : '예문 등록'}
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('성공') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamplesRegister;
