import React, { useState, useEffect } from 'react';
import { Button, Card, Loader, Message, Panel, Grid, Row, Col } from 'rsuite';
import { Icon } from '@rsuite/icons';
import { Reload } from '@rsuite/icons';
import { getExamplesForUser } from '../api/api';
import ExampleCard from '../components/ExampleCard';
import './RecommendExamples.css';

const RecommendExamples = () => {
  const [examples, setExamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadExamples = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getExamplesForUser();
      setExamples(response.data || []);
    } catch (err) {
      console.error('예문 로드 실패:', err);
      setError('예문를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamples();
  }, []);

  const renderExampleCard = (example) => (
    <div key={example.id} className="recommend-examples-card-wrapper">
      <ExampleCard example={example} isMain={false} />
    </div>
  );

  return (
    <div className="recommend-examples-page">
      <Panel header={
        <div className="recommend-examples-header-content">
          <span className="recommend-examples-header-title">문장 학습</span>
          <Button 
            appearance="ghost" 
            onClick={loadExamples}
            loading={loading}
            className="recommend-examples-refresh-btn"
            size="sm"
          >
            <Reload />
          </Button>
        </div>
      } className="recommend-examples-page-header">
      </Panel>

      {loading ? (
        <div className="recommend-examples-loading-container">
          <Loader size="lg" content="예문을 불러오는 중..." />
        </div>
      ) : error ? (
        <Message type="error" showIcon>
          {error}
          <Button onClick={loadExamples} style={{ marginLeft: 10 }}>
            다시 시도
          </Button>
        </Message>
      ) : examples.length === 0 ? (
        <Message type="info" showIcon>
          추천할 예문이 없습니다.
        </Message>
      ) : (
        <div className="recommend-examples-grid">
          {examples.map(renderExampleCard)}
        </div>
      )}
    </div>
  );
};

export default RecommendExamples;
