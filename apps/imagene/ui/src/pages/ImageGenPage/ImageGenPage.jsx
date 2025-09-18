import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Button, Stack, Form, InputNumber, Input, Slider, CheckPicker, Divider, Card } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import './ImageGenPage.css';
import { createImagesBatch } from '../../api/api';
import { PromptGenerator } from '../../components/PromptGenerator';
export const env = import.meta.env;

export const ImageGenPage = () => {
  // 파라미터 범위 설정 상태
  const [model, setModel] = useState(env.VITE_SD_MODEL_PATH);
  const [seed_range, setSeedRange] = useState(env.VITE_SD_SEED_RANGE.split('~').map(Number) || [0, 1000000]);
  const [steps_range, setStepsRange] = useState(env.VITE_SD_STEPS_RANGE.split('~').map(Number) || [1, 50]);
  const [cfg_range, setCfgRange] = useState(env.VITE_SD_CFG_RANGE.split('~').map(Number) || [1, 20]);
  const [resolution_options, setResolutionOptions] = useState(env.VITE_SD_RESOLUTION_OPTIONS.split(',').map((item) => item.split('x').map(Number)) || [[768, 1280], [1024, 1024], [1280, 768]]);  
  const [positive_prompt_length_range, setPositivePromptLengthRange] = useState(env.VITE_SD_POSITIVE_PROMPT_LENGTH_RANGE.split('~').map(Number) || [0, 0]);
  const [negative_prompt_length_range, setNegativePromptLengthRange] = useState(env.VITE_SD_NEGATIVE_PROMPT_LENGTH_RANGE.split('~').map(Number) || [0, 0]);
  
  // 생성 설정 상태
  const [positive_keywords, setPositiveKeywords] = useState(env.VITE_SD_POSITIVE_KEYWORDS || '');
  const [negative_keywords, setNegativeKeywords] = useState(env.VITE_SD_NEGATIVE_KEYWORDS || '');
  const [mutation, setMutation] = useState(env.VITE_SD_MUTATION || 10);
  const [nGen, setNGen] = useState(env.VITE_SD_NGEN || 2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentRandomSettings, setCurrentRandomSettings] = useState([]);
  
  // 자동 반복 설정 상태
  const [isAutoRepeat, setIsAutoRepeat] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [totalRepeatCount, setTotalRepeatCount] = useState(0);
  
  // 프롬프트 생성기 상태
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  
  const {
    images,
    keywordsByKey,
    imageFilterData,
    refreshImages
  } = useImageFilter();
  

  useEffect(() => {
    if (isAutoRepeat) {
      submit();
    }
  }, [isAutoRepeat]);

  // 프롬프트 생성기에서 프롬프트 변경 핸들러
  const handlePromptChange = (formattedKeywords) => {    
    setPositiveKeywords(formattedKeywords);
  };

  // 무작위 키워드 선택 함수
  const getRandomKeywords = (keyType, count = 40) => {
    let keywords = [];
    if (keywordsByKey) {
      Object.entries(keywordsByKey).forEach(([keywordKey, keyKeywords]) => {
        Object.entries(keyKeywords).forEach(([key, keywordValue]) => {
          if (keyType === 'positive') {
            if (keywordValue.direction > 0) {
              keywords.push(keywordValue);
            }
          } else {
            if (keywordValue.direction < 0) {
              keywords.push(keywordValue);
            }
          }
        });
      });
    }
    const prompt_keywords_list = [];
    Object.entries(prompt_keywords).forEach(([prompt_key_type, prompt_key_values]) => {
      prompt_key_values.forEach((prompt_key_value) => {
        prompt_key_value.split(',').forEach((prompt_key_value_item) => {
          if (prompt_key_type === 'negative' && keyType === 'negative') {
            prompt_keywords_list.push({key: prompt_key_type, value: prompt_key_value_item, direction: -1});
          } else if (prompt_key_type !== 'negative' && keyType === 'positive') {
            prompt_keywords_list.push({key: prompt_key_type, value: prompt_key_value_item, direction: 1});
          } 
        });
      });
    });    
    keywords = [...keywords].sort(() => 0.5 - Math.random()).slice(0, count);
    for (let i = 0; i < Math.min(mutation, keywords.length); i++) {
      keywords[i] = prompt_keywords_list[Math.floor(Math.random() * prompt_keywords_list.length)];
    }
    keywords = [...keywords].sort(() => 0.5 - Math.random());
    return keywords;
  };
  const getPositiveKeywords = () => {
    const keywords = [];
    for (const keyword of positive_keywords.split(',')) {
      if (keyword.trim() !== '') {
        const [key, value] = keyword.trim().slice(1, -1).split(':');
        if (key && value) {
          keywords.push({
          key: key,
            value: value,
            direction: 1
          });
        }
      }
    }
    return keywords;
  };

  const getNegativeKeywords = () => {
    const keywords = [];
    for (const keyword of negative_keywords.split(',')) {
      if (keyword.trim() !== '') {
          keywords.push({
            key: 'negative',
            value: keyword.trim(),
            direction: -1
          });
      }
    }
    return keywords;
  };

  const selectRandomSettings = ({nGen = 1}) => {
    const randomSteps = Math.floor(Math.random() * (steps_range[1] - steps_range[0] + 1)) + steps_range[0];
    const randomCfg = Math.round(((Math.random() * (cfg_range[1] - cfg_range[0] + 1)) + cfg_range[0]) * 10) / 10;
    const randomResolution = resolution_options[Math.floor(Math.random() * resolution_options.length)];
    const randomWidth = randomResolution[0];
    const randomHeight = randomResolution[1];

    const createImageDataList = [];

    const pool = []
    images.forEach(image => {
      const dna = [];
      image.keywords.forEach(keyword => {
        dna.push(keyword);
      });
      pool.push(dna);
    });

    // 무작위 키워드 생성
    let defaultPositiveKeywords = getPositiveKeywords();
    let positiveKeywordsList = [];
    if (defaultPositiveKeywords.length > 0 && defaultPositiveKeywords[0].value !== null) {
      for (let i = 0; i < nGen; i++) {
        positiveKeywordsList.push(defaultPositiveKeywords);
      }
    } else {
      positiveKeywordsList = genOffsprings(pool, mutation, nGen);
    }

    for (let i = 0; i < nGen; i++) {
      const randomPositivePromptLength = Math.floor(Math.random() * (positive_prompt_length_range[1] - positive_prompt_length_range[0] + 1)) + positive_prompt_length_range[0];
      let positiveKeywords = positiveKeywordsList[i].slice(0, randomPositivePromptLength);
      const randomNegativePromptLength = Math.floor(Math.random() * (negative_prompt_length_range[1] - negative_prompt_length_range[0] + 1)) + negative_prompt_length_range[0];
      
      let negativeKeywords = getNegativeKeywords();
      if (negativeKeywords.length === 0 || negativeKeywords[0].value === null) {
        negativeKeywords = getRandomKeywords('negative', randomNegativePromptLength);
      }

      // DNA 배열 생성
      const keywords = [];
      keywords.push(...positiveKeywords);
      keywords.push(...negativeKeywords);      

      const randomSeed = Math.floor(Math.random() * (seed_range[1] - seed_range[0] + 1)) + seed_range[0];

      const createImageData = {
        keywords: keywords,
        group_ids: imageFilterData.group_ids,
        model: model,
        seed: randomSeed,
        steps: randomSteps,
        cfg: randomCfg,
        width: randomWidth,
        height: randomHeight,
      };
      createImageDataList.push(createImageData);
    }
    return createImageDataList;
  };


  const submit = async () => {
    setIsGenerating(true);
    setGeneratedImages([]);
    
    try {
      const createImageDataList = selectRandomSettings({nGen});
      setCurrentRandomSettings(createImageDataList); // 랜덤 설정값 저장
      const result = await createImagesBatch(createImageDataList);
      
      if (result) {
        setGeneratedImages(result.data);
        // 이미지 생성 후 목록 새로고침
        await refreshImages();
        
        // 자동 반복이 활성화되어 있으면 카운트 증가
        console.log('isAutoRepeat', isAutoRepeat);
        if (isAutoRepeat) {
          console.log('isAutoRepeat', isAutoRepeat);
          setRepeatCount(prev => prev + 1);
          setTotalRepeatCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('이미지 생성 중 오류 발생:', error);
        alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
        setIsGenerating(false);
        
        // 자동 반복이 활성화되어 있으면 다음 생성 시작
        if (isAutoRepeat) {
          setTimeout(() => {
            submit();
          }, 1000); // 1초 후 다음 생성 시작
        }
    }
  };

  const toggleAutoRepeat = () => {
    if (isAutoRepeat) {
      // 자동 반복 중지
      setIsAutoRepeat(false);
      setRepeatCount(0);
    } else {
      // 자동 반복 시작
      setIsAutoRepeat(true);
      setRepeatCount(0);
    }
  };

  const setPositiveKeywordsFromCurrentGroup = () => {
    let newPositiveKeywords = [];
    const seen = new Set();
    images.forEach(image => {
      image.keywords.forEach(keyword => {
        if (keyword.direction > 0 && !seen.has(keyword.value)) {
          newPositiveKeywords.push(`{${keyword.key}:${keyword.value}}`);
          seen.add(keyword.value);
        }
      });
    });
    setPositiveKeywords(newPositiveKeywords.join(','));
  };

  return (
    <div className="image-gen-page">
      <div className="image-gen-page-header">
        <h2 className="image-gen-page-title">이미지 생성 설정</h2>
        <div className="image-gen-page-header-buttons">
          <Button 
            appearance="primary" 
            onClick={submit}
            loading={isGenerating}
            disabled={isGenerating}
            size="lg"
            className="image-gen-page-submit-button"
          >
            {isGenerating ? '생성 중...' : '이미지 생성'}
          </Button>
          
          <Button 
            appearance={isAutoRepeat ? "default" : "ghost"}
            color={isAutoRepeat ? "red" : "blue"}
            onClick={toggleAutoRepeat}
            size="lg"
            className="image-gen-page-auto-repeat-button"
          >
            {isAutoRepeat ? '🛑 자동 반복 중지' : '🔄 자동 반복 시작'}
          </Button>
        </div>
      </div>
      
      <div className="image-gen-page-body">
        <Stack spacing={24}>
          {/* 생성된 이미지 표시 영역 */}
          {generatedImages.length > 0 && (
            <Card className="image-gen-page-generated-images-container">
              <Card.Header>
                <h4 className="image-gen-page-generated-images-title">생성된 이미지</h4>
              </Card.Header>
              <Card.Body>
                <div className="image-gen-page-generated-images-grid">
                  {generatedImages.map((image, index) => (
                    <div key={index} className="image-gen-page-generated-image-item">
                      <img 
                        src={`http://localhost:8000/${image.url}`} 
                        alt={`Generated ${index + 1}`} 
                        className="image-gen-page-generated-image"
                      />
                      <div className="image-gen-page-generated-image-info">
                        <div>Seed: {image.seed}</div>
                        <div>Steps: {image.steps}</div>
                        <div>CFG: {image.cfg}</div>
                        <div>Size: {image.width}x{image.height}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* 자동 반복 상태 표시 */}
          {isAutoRepeat && (
            <Card className="image-gen-page-auto-repeat-container">
              <Card.Body>
                <div className="image-gen-page-auto-repeat-title">
                  🔄 자동 반복 모드 활성화
                </div>
                <div className="image-gen-page-auto-repeat-stats">
                  <div>현재 세션: {repeatCount}회 완료</div>
                  <div>총 생성: {totalRepeatCount}회 완료</div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* 로딩 상태 표시 */}
          {isGenerating && (
            <Card className="image-gen-page-loading-container">
              <Card.Body>
                <div className="image-gen-page-loading-title">이미지 생성 중...</div>
                <div className="image-gen-page-loading-subtitle">잠시만 기다려주세요</div>
                {isAutoRepeat && (
                  <div className="image-gen-page-loading-auto-repeat">
                    자동 반복 중... ({repeatCount + 1}회차)
                  </div>
                )}
                
                {/* 실제로 확정된 랜덤 값들 표시 */}
                <div className="image-gen-page-loading-parameters">
                  <h6 className="image-gen-page-loading-parameters-title">확정된 생성 설정</h6>
                  <div className="image-gen-page-loading-parameters-list">
                    {currentRandomSettings.map((setting, index) => (
                      <div key={index} className="image-gen-page-loading-parameter-group">
                        <div className="image-gen-page-loading-parameter-group-title">
                          이미지 {index + 1}
                        </div>
                        <div className="image-gen-page-loading-parameter-grid">
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">Seed:</span>
                            <span className="image-gen-page-loading-parameter-value">{setting.seed}</span>
                          </div>
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">Steps:</span>
                            <span className="image-gen-page-loading-parameter-value">{setting.steps}</span>
                          </div>
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">CFG:</span>
                            <span className="image-gen-page-loading-parameter-value">{setting.cfg}</span>
                          </div>
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">해상도:</span>
                            <span className="image-gen-page-loading-parameter-value">{setting.width} x {setting.height}</span>
                          </div>
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">Positive 키워드:</span>
                            <span className="image-gen-page-loading-parameter-value">
                              {setting.keywords.filter(k => k.direction > 0).length}개
                            </span>
                          </div>
                          <div className="image-gen-page-loading-parameter-item">
                            <span className="image-gen-page-loading-parameter-label">Negative 키워드:</span>
                            <span className="image-gen-page-loading-parameter-value">
                              {setting.keywords.filter(k => k.direction < 0).length}개
                            </span>
                          </div>
                        </div>
                        {/* 키워드 미리보기 */}
                        <div className="image-gen-page-loading-keywords-preview">
                          <div className="image-gen-page-loading-keywords-section">
                            <span className="image-gen-page-loading-keywords-label">Positive:</span>
                            <span className="image-gen-page-loading-keywords-text">
                              {setting.keywords.filter(k => k.direction > 0).map(k => k.value).join(', ')}
                            </span>
                          </div>
                          <div className="image-gen-page-loading-keywords-section">
                            <span className="image-gen-page-loading-keywords-label">Negative:</span>
                            <span className="image-gen-page-loading-keywords-text">
                              {setting.keywords.filter(k => k.direction < 0).map(k => k.value).join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* 파라미터 범위 설정 영역 */}
          <div className="image-gen-page-parameters-section">
            <Card.Header>
              <h5 className="image-gen-page-section-title">파라미터 범위 설정</h5>
            </Card.Header>
            <Card.Body>
              <Form fluid>
                {/* 생성 개수 설정 */}
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    생성할 이미지 개수
                  </Form.ControlLabel>
                  <InputNumber 
                    min={1} 
                    max={50}
                    value={nGen} 
                    onChange={setNGen}
                    style={{ width: '100%' }}
                    disabled={isGenerating}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    변이 개수
                  </Form.ControlLabel>
                  <InputNumber 
                    min={0} 
                    max={50} 
                    value={mutation} 
                    onChange={setMutation}
                    style={{ width: '100%' }}
                    disabled={isGenerating}
                  />
                </Form.Group>
                <Divider />

                {/* Seed 범위 설정 */}
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    Seed 범위: {seed_range[0]} ~ {seed_range[1]}
                  </Form.ControlLabel>
                  <div className="image-gen-page-range-container">
                    <InputNumber 
                      min={0} 
                      max={1000000} 
                      value={seed_range[0]} 
                      onChange={(v) => setSeedRange([v, seed_range[1]])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최소값"
                    />
                    <span className="image-gen-page-range-separator">~</span>
                    <InputNumber 
                      min={0} 
                      max={1000000} 
                      value={seed_range[1]} 
                      onChange={(v) => setSeedRange([seed_range[0], v])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최대값"
                    />
                  </div>
                </Form.Group>

                {/* Steps 범위 설정 */}
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    Steps 범위: {steps_range[0]} ~ {steps_range[1]}
                  </Form.ControlLabel>
                  <div className="image-gen-page-range-container">
                    <InputNumber 
                      min={1} 
                      max={50} 
                      value={steps_range[0]} 
                      onChange={(v) => setStepsRange([v, steps_range[1]])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최소값"
                    />
                    <span className="image-gen-page-range-separator">~</span>
                    <InputNumber 
                      min={1} 
                      max={50} 
                      value={steps_range[1]} 
                      onChange={(v) => setStepsRange([steps_range[0], v])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최대값"
                    />
                  </div>
                </Form.Group>

                {/* CFG 범위 설정 */}
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    CFG 범위: {cfg_range[0]} ~ {cfg_range[1]}
                  </Form.ControlLabel>
                  <div className="image-gen-page-range-container">
                    <InputNumber 
                      min={1} 
                      max={20} 
                      step={0.1}
                      value={cfg_range[0]} 
                      onChange={(v) => setCfgRange([v, cfg_range[1]])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최소값"
                    />
                    <span className="image-gen-page-range-separator">~</span>
                    <InputNumber 
                      min={1} 
                      max={20} 
                      step={0.1}
                      value={cfg_range[1]} 
                      onChange={(v) => setCfgRange([cfg_range[0], v])}
                      disabled={isGenerating}
                      style={{ width: '45%' }}
                      placeholder="최대값"
                    />
                  </div>
                </Form.Group>

                <Divider />

                {/* 해상도 옵션 설정 */}
                <Form.Group>
                  <Form.ControlLabel className="image-gen-page-form-label">
                    사용할 해상도 옵션들
                  </Form.ControlLabel>
                  <div className="image-gen-page-resolution-options">
                    {resolution_options.map((resolution, index) => (
                      <div key={index} className="image-gen-page-resolution-option">
                        <span>{resolution[0]} x {resolution[1]}</span>
                        <Button 
                          size="xs" 
                          appearance="ghost" 
                          color="red"
                          onClick={() => {
                            const newOptions = resolution_options.filter((_, i) => i !== index);
                            setResolutionOptions(newOptions);
                          }}
                          disabled={isGenerating || resolution_options.length <= 1}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    size="sm" 
                    appearance="ghost" 
                    onClick={() => {
                      const width = Math.floor(Math.random() * 1000) + 512;
                      const height = Math.floor(Math.random() * 1000) + 512;
                      setResolutionOptions([...resolution_options, [width, height]]);
                    }}
                    disabled={isGenerating}
                    style={{ marginTop: 8 }}
                  >
                    + 해상도 추가
                  </Button>
                </Form.Group>

                <Divider />

                {/* 프롬프트 길이 범위 설정 */}
                <div className="image-gen-page-prompt-length-section">
                  <h6 className="image-gen-page-subsection-title">프롬프트 길이 범위</h6>
                  
                  <Form.Group>
                    <Form.ControlLabel className="image-gen-page-form-label">
                      Positive 프롬프트 키워드 개수: {positive_prompt_length_range[0]} ~ {positive_prompt_length_range[1]}
                    </Form.ControlLabel>
                    <div className="image-gen-page-range-container">
                      <InputNumber 
                        min={0} 
                        max={50} 
                        value={positive_prompt_length_range[0]} 
                        onChange={(v) => setPositivePromptLengthRange([Number(v), positive_prompt_length_range[1]])}
                        disabled={isGenerating}
                        style={{ width: '45%' }}
                        placeholder="최소값"
                      />
                      <span className="image-gen-page-range-separator">~</span>
                      <InputNumber 
                        min={0} 
                        max={50} 
                        value={positive_prompt_length_range[1]} 
                        onChange={(v) => setPositivePromptLengthRange([positive_prompt_length_range[0], Number(v)])}
                        disabled={isGenerating}
                        style={{ width: '45%' }}
                        placeholder="최대값"
                      />
                    </div>
                  </Form.Group>

                  <Form.Group>
                    <Form.ControlLabel className="image-gen-page-form-label">
                      Negative 프롬프트 키워드 개수: {negative_prompt_length_range[0]} ~ {negative_prompt_length_range[1]}
                    </Form.ControlLabel>
                    <div className="image-gen-page-range-container">
                      <InputNumber 
                        min={0} 
                        max={50} 
                        value={negative_prompt_length_range[0]} 
                        onChange={(v) => setNegativePromptLengthRange([Number(v), negative_prompt_length_range[1]])}
                        disabled={isGenerating}
                        style={{ width: '45%' }}
                        placeholder="최소값"
                      />
                      <span className="image-gen-page-range-separator">~</span>
                      <InputNumber 
                        min={0} 
                        max={50} 
                        value={negative_prompt_length_range[1]} 
                        onChange={(v) => setNegativePromptLengthRange([negative_prompt_length_range[0], Number(v)])}
                        disabled={isGenerating}
                        style={{ width: '45%' }}
                        placeholder="최대값"
                      />
                    </div>
                  </Form.Group>
                </div>

                <Divider />

                {/* 키워드 입력 영역 */}
                <div className="image-gen-page-keywords-section">
                  <h6 className="image-gen-page-subsection-title">기본 키워드 설정</h6>
                  
                  <Form.Group>
                    <div className="image-gen-page-form-label-container">
                      <Form.ControlLabel className="image-gen-page-form-label">
                        Positive 키워드
                      </Form.ControlLabel>
                      <Button
                        size="xs"
                        appearance="ghost"
                        onClick={() => setPositiveKeywordsFromCurrentGroup()}
                        disabled={isGenerating}
                        className="image-gen-page-prompt-generator-button"
                      >
                        그룹 키워드
                      </Button>
                      <Button
                        size="xs"
                        appearance="ghost"
                        onClick={() => setShowPromptGenerator(true)}
                        disabled={isGenerating}
                        className="image-gen-page-prompt-generator-button"
                      >
                        🎨 프롬프트 생성기
                      </Button>
                    </div>
                    <Input 
                      as="textarea" 
                      rows={3}
                      value={positive_keywords} 
                      onChange={(v) => setPositiveKeywords(v)}
                      disabled={isGenerating}
                      style={{ width: '100%' }}
                      placeholder="예: {appearance: beautiful}, {detail: detailed}, {quality: high}, {style: masterpiece}"
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.ControlLabel className="image-gen-page-form-label">
                      Negative 키워드
                    </Form.ControlLabel>
                    <Input 
                      as="textarea" 
                      rows={3}
                      value={negative_keywords} 
                      onChange={(v) => setNegativeKeywords(v)}
                      disabled={isGenerating}
                      style={{ width: '100%' }}
                      placeholder="예: blurry, low quality, distorted, ugly"
                    />
                  </Form.Group>
                </div>
              </Form>
            </Card.Body>
          </div>
        </Stack>
      </div>
      
      {/* 프롬프트 생성기 모달 */}
      <PromptGenerator 
        show={showPromptGenerator}
        onClose={() => setShowPromptGenerator(false)}
        onPromptChange={handlePromptChange}
        disabled={isGenerating}
      />
    </div>
  );
};
