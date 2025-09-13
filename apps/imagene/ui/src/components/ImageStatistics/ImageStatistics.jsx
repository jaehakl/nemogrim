import React, { useEffect, useMemo } from 'react';
import { Divider, Panel, Grid, Row, Col, Card } from 'rsuite';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  LineChart,
  Line
} from 'recharts';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import './ImageStatistics.css';

export const ImageStatistics = () => {
  const {
    images,
    loading
  } = useImageFilter();

  const statistics = useMemo(() => {
    if (!images || images.length === 0) {
      return {
        steps: [],
        cfg: [],
        resolution: [],
        positive_prompt_length: [],
        negative_prompt_length: [],
        positive_prompt_keywords: [],
        negative_prompt_keywords: [],
        summary: {
          totalImages: 0,
          avgSteps: 0,
          avgCfg: 0,
          avgPositivePromptLength: 0,
          avgNegativePromptLength: 0,
          commonResolutions: []
        }
      };
    }

    const histogram = {
      steps: [],
      cfg: [],
      resolution: [],
      positive_prompt_length: [],
      negative_prompt_length: [],
      positive_prompt_keywords: [],
      negative_prompt_keywords: [],
    };

    images.forEach(image => {
      histogram.steps.push(image.steps);
      histogram.cfg.push(image.cfg);
      histogram.resolution.push([image.width, image.height]);
      histogram.positive_prompt_length.push(image.positive_prompt.split(',').length);
      histogram.negative_prompt_length.push(image.negative_prompt.split(',').length);
      histogram.positive_prompt_keywords = [...histogram.positive_prompt_keywords, ...(image.positive_prompt.split(','))];
      histogram.negative_prompt_keywords = [...histogram.negative_prompt_keywords, ...(image.negative_prompt.split(','))];
    });

    // 통계 요약 계산
    const totalImages = images.length;
    const avgSteps = histogram.steps.reduce((a, b) => a + b, 0) / totalImages;
    const avgCfg = histogram.cfg.reduce((a, b) => a + b, 0) / totalImages;
    const avgPositivePromptLength = histogram.positive_prompt_length.reduce((a, b) => a + b, 0) / totalImages;
    const avgNegativePromptLength = histogram.negative_prompt_length.reduce((a, b) => a + b, 0) / totalImages;

    // 해상도별 빈도 계산
    const resolutionCount = {};
    histogram.resolution.forEach(([width, height]) => {
      const key = `${width}x${height}`;
      resolutionCount[key] = (resolutionCount[key] || 0) + 1;
    });
    const commonResolutions = Object.entries(resolutionCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resolution, count]) => ({ resolution, count }));

    return {
      ...histogram,
      summary: {
        totalImages,
        avgSteps: Math.round(avgSteps * 100) / 100,
        avgCfg: Math.round(avgCfg * 100) / 100,
        avgPositivePromptLength: Math.round(avgPositivePromptLength * 100) / 100,
        avgNegativePromptLength: Math.round(avgNegativePromptLength * 100) / 100,
        commonResolutions
      }
    };
  }, [images]);

  // Steps 히스토그램 데이터 생성
  const stepsData = useMemo(() => {
    const stepCount = {};
    statistics.steps.forEach(step => {
      stepCount[step] = (stepCount[step] || 0) + 1;
    });
    return Object.entries(stepCount)
      .map(([step, count]) => ({ step: parseInt(step), count }))
      .sort((a, b) => a.step - b.step);
  }, [statistics.steps]);

  // CFG 히스토그램 데이터 생성
  const cfgData = useMemo(() => {
    const cfgCount = {};
    statistics.cfg.forEach(cfg => {
      const roundedCfg = Math.round(cfg * 2) / 2; // 0.5 단위로 반올림
      cfgCount[roundedCfg] = (cfgCount[roundedCfg] || 0) + 1;
    });
    return Object.entries(cfgCount)
      .map(([cfg, count]) => ({ cfg: parseFloat(cfg), count }))
      .sort((a, b) => a.cfg - b.cfg);
  }, [statistics.cfg]);

  // Positive Prompt Length 히스토그램 데이터 생성
  const positivePromptLengthData = useMemo(() => {
    const lengthCount = {};
    statistics.positive_prompt_length.forEach(length => {
      lengthCount[length] = (lengthCount[length] || 0) + 1;
    });
    return Object.entries(lengthCount)
      .map(([length, count]) => ({ length: parseInt(length), count }))
      .sort((a, b) => a.length - b.length);
  }, [statistics.positive_prompt_length]);

  // Negative Prompt Length 히스토그램 데이터 생성
  const negativePromptLengthData = useMemo(() => {
    const lengthCount = {};
    statistics.negative_prompt_length.forEach(length => {
      lengthCount[length] = (lengthCount[length] || 0) + 1;
    });
    return Object.entries(lengthCount)
      .map(([length, count]) => ({ length: parseInt(length), count }))
      .sort((a, b) => a.length - b.length);
  }, [statistics.negative_prompt_length]);

  // 해상도 분포 데이터 생성
  const resolutionData = useMemo(() => {
    return statistics.summary.commonResolutions.map((item, index) => ({
      ...item,
      fill: `hsl(${index * 36}, 70%, 50%)`
    }));
  }, [statistics.summary.commonResolutions]);

  // Steps vs CFG 산점도 데이터
  const stepsVsCfgData = useMemo(() => {
    return statistics.steps.map((step, index) => ({
      steps: step,
      cfg: statistics.cfg[index]
    }));
  }, [statistics.steps, statistics.cfg]);

  // 해상도 vs CFG 산점도 데이터 (해상도는 라벨 "W x H"로 표시, 정렬은 MP 기준)
  const resolutionVsCfgData = useMemo(() => {
    const data = statistics.resolution.map(([width, height], index) => {
      const mp = Math.round(((width || 0) * (height || 0)) / 10000) / 100; // MP 단위(소수점 2)
      return {
        mp,
        cfg: statistics.cfg[index],
        width,
        height,
        resolutionLabel: `${width} x ${height}`
      };
    });
    return data.sort((a, b) => a.mp - b.mp);
  }, [statistics.resolution, statistics.cfg]);

  // Positive Prompt Length vs CFG 산점도 데이터
  const positiveLengthVsCfgData = useMemo(() => {
    return statistics.positive_prompt_length.map((length, index) => ({
      length,
      cfg: statistics.cfg[index]
    }));
  }, [statistics.positive_prompt_length, statistics.cfg]);

  // Negative Prompt Length vs CFG 산점도 데이터
  const negativeLengthVsCfgData = useMemo(() => {
    return statistics.negative_prompt_length.map((length, index) => ({
      length,
      cfg: statistics.cfg[index]
    }));
  }, [statistics.negative_prompt_length, statistics.cfg]);

  // Positive Prompt 키워드 빈도 데이터
  const positiveKeywordData = useMemo(() => {
    const keywordCount = {};
    const keywords = statistics.positive_prompt_keywords || [];
    keywords.forEach(keyword => {
      const trimmed = keyword.trim();
      if (trimmed) {
        keywordCount[trimmed] = (keywordCount[trimmed] || 0) + 1;
      }
    });
    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 상위 20개만 표시
  }, [statistics.positive_prompt_keywords]);

  // Negative Prompt 키워드 빈도 데이터
  const negativeKeywordData = useMemo(() => {
    const keywordCount = {};
    const keywords = statistics.negative_prompt_keywords || [];
    keywords.forEach(keyword => {
      const trimmed = keyword.trim();
      if (trimmed) {
        keywordCount[trimmed] = (keywordCount[trimmed] || 0) + 1;
      }
    });
    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 상위 20개만 표시
  }, [statistics.negative_prompt_keywords]);

  if (loading) {
    return (
      <div className="statistics-loading">
        <p>통계 데이터를 로딩 중...</p>
      </div>
    );
  }

  if (statistics.summary.totalImages === 0) {
    return (
      <div className="statistics-empty">
        <p>분석할 이미지가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="image-statistics">
      <h2>이미지 통계 분석</h2>
      
      {/* 요약 통계 */}
      <Panel header="요약 통계" className="summary-panel">
        <Grid fluid>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card className="stat-card">
                <div className="stat-content">
                  <div className="stat-title">총 이미지 수</div>
                  <div className="stat-value stat-blue">{statistics.summary.totalImages}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stat-card">
                <div className="stat-content">
                  <div className="stat-title">평균 Steps</div>
                  <div className="stat-value stat-green">{statistics.summary.avgSteps}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stat-card">
                <div className="stat-content">
                  <div className="stat-title">평균 CFG</div>
                  <div className="stat-value stat-orange">{statistics.summary.avgCfg}</div>
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card className="stat-card">
                <div className="stat-content">
                  <div className="stat-title">평균 Positive Prompt 길이</div>
                  <div className="stat-value stat-purple">{statistics.summary.avgPositivePromptLength}</div>
                </div>
              </Card>
            </Col>
          </Row>
        </Grid>
      </Panel>

      <Divider />

      {/* Steps & CFG 분포 */}
      <Panel header="Steps & CFG 분포" className="chart-panel">
        <Grid fluid>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <h4>Steps 분포</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stepsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <h4>CFG 분포</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cfgData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cfg" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <h4>Steps vs CFG 상관관계</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart data={stepsVsCfgData} margin={{ top: 10, right: 16, bottom: 28, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="steps"
                    name="Steps"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDecimals={false}
                    tickCount={6}
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                  />
                  <YAxis dataKey="cfg" name="CFG" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter dataKey="cfg" fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Grid>
      </Panel>

      <Divider />

      {/* 해상도 분포 */}
      <Panel header="해상도 분포" className="chart-panel">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={resolutionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ resolution, percent }) => `${resolution} (${(percent * 100).toFixed(1)}%)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="count"
            >
              {resolutionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Divider />

      {/* 해상도/프롬프트 길이 vs CFG 상관관계 */}
      <Panel header="해상도/프롬프트 길이 vs CFG 상관관계" className="chart-panel">
        <Grid fluid>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <h4>해상도(W x H) vs CFG</h4>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart data={resolutionVsCfgData} margin={{ top: 10, right: 16, bottom: 44, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="resolutionLabel"
                    name="해상도"
                    type="category"
                    interval={0}
                    allowDuplicatedCategory={false}
                    tick={{ fontSize: 11 }}
                    tickMargin={12}
                    angle={-30}
                    textAnchor="end"
                  />
                  <YAxis dataKey="cfg" name="CFG" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} labelFormatter={(label) => `${label}`} />
                  <Scatter dataKey="cfg" fill="#7cb5ec" />
                </ScatterChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <h4>Positive Prompt 길이 vs CFG</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart data={positiveLengthVsCfgData} margin={{ top: 10, right: 16, bottom: 28, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="length"
                    name="길이"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDecimals={false}
                    tickCount={6}
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                  />
                  <YAxis dataKey="cfg" name="CFG" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter dataKey="cfg" fill="#90ed7d" />
                </ScatterChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} sm={24} lg={8}>
              <h4>Negative Prompt 길이 vs CFG</h4>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart data={negativeLengthVsCfgData} margin={{ top: 10, right: 16, bottom: 28, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="length"
                    name="길이"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDecimals={false}
                    tickCount={6}
                    tick={{ fontSize: 11 }}
                    tickMargin={8}
                  />
                  <YAxis dataKey="cfg" name="CFG" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter dataKey="cfg" fill="#f45b5b" />
                </ScatterChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Grid>
      </Panel>

      <Divider />

      {/* Prompt Length 분포 */}
      <Panel header="Prompt Length 분포" className="chart-panel">
        <Grid fluid>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={12}>
              <h4>Positive Prompt Length</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={positivePromptLengthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="length" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} sm={12} lg={12}>
              <h4>Negative Prompt Length</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={negativePromptLengthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="length" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ff7300" />
                </BarChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Grid>
      </Panel>

      <Divider />

      {/* 키워드 빈도 분석 */}
      <Panel header="키워드 빈도 분석" className="chart-panel">
        <Grid fluid>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={12}>
              <h4>Positive Prompt 키워드 (상위 20개)</h4>
              <div className="keyword-list">
                {positiveKeywordData.length > 0 ? (
                  positiveKeywordData.map((item, index) => (
                    <div key={index} className="keyword-item positive">
                      <span className="keyword-text">{item.keyword}</span>
                      <span className="keyword-count">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-keywords">키워드가 없습니다.</p>
                )}
              </div>
            </Col>
            <Col xs={24} sm={12} lg={12}>
              <h4>Negative Prompt 키워드 (상위 20개)</h4>
              <div className="keyword-list">
                {negativeKeywordData.length > 0 ? (
                  negativeKeywordData.map((item, index) => (
                    <div key={index} className="keyword-item negative">
                      <span className="keyword-text">{item.keyword}</span>
                      <span className="keyword-count">{item.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-keywords">키워드가 없습니다.</p>
                )}
              </div>
            </Col>
          </Row>
        </Grid>
      </Panel>
    </div>
  );
};