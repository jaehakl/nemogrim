import React, { useMemo, useState, useRef } from 'react';
import { Button, Stack, Modal, Form, InputNumber, Input } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import './ImageGenModal.css';

export const ImageGenModal = ({ open, onClose }) => {
  const [positive, setPositive] = useState('');
  const [negative, setNegative] = useState('');
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(5.5);
  const [height, setHeight] = useState(1024);
  const [width, setWidth] = useState(1024);
  const [userEdited, setUserEdited] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const autoGenerateRef = useRef(false);

  const { refreshImages, selectedKeywords, keywordsByKey } = useImageFilter();

  // 무작위 키워드 선택 함수들
  const getRandomKeywords = (keyType, count = 3) => {
    if (!keywordsByKey || !keywordsByKey[keyType]) return [];
    
    const keywords = keywordsByKey[keyType];
    const shuffled = [...keywords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(kw => kw.value);
  };

  const selectRandomPositive = () => {
    const randomKeywords = getRandomKeywords('positive', 40);
    setPositive(randomKeywords.join(', '));
    setUserEdited(true);
  };

  const selectRandomNegative = () => {
    const randomKeywords = getRandomKeywords('negative', 40);
    setNegative(randomKeywords.join(', '));
    setUserEdited(true);
  };

  const selectRandomSettings = () => {
    // 무작위 설정값 생성
    const randomSteps = Math.floor(Math.random() * 31) + 20; // 20-50
    const randomCfg = Math.round((Math.random() * 5 + 5) * 10) / 10; // 5.0-10.0
    const randomHeight = [512, 768, 1024, 1280, 1536][Math.floor(Math.random() * 5)];
    const randomWidth = [512, 768, 1024, 1280, 1536][Math.floor(Math.random() * 5)];
    
    setSteps(randomSteps);
    setCfg(randomCfg);
    setHeight(randomHeight);
    setWidth(randomWidth);
    setUserEdited(true);
  };

  const selectRandomAll = () => {
    selectRandomPositive();
    selectRandomNegative();
    selectRandomSettings();
  };

  // 자동 생성 루프 함수
  const startAutoGeneration = async () => {
    setIsAutoGenerating(true);
    setGeneratedCount(0);
    autoGenerateRef.current = true;
    
    const autoGenerateLoop = async () => {
      while (autoGenerateRef.current) {
        try {
          // 무작위 설정 적용
          selectRandomAll();
          
          // 잠시 대기 (UI 업데이트를 위해)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 이미지 생성
          await submit();
          
          // 생성 카운트 증가
          setGeneratedCount(prev => prev + 1);
          
          // 다음 생성 전 잠시 대기 (서버 부하 방지)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error('자동 생성 중 오류 발생:', error);
          // 오류가 발생해도 계속 진행
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    
    autoGenerateLoop();
  };

  const stopAutoGeneration = () => {
    autoGenerateRef.current = false;
    setIsAutoGenerating(false);
  };

  React.useEffect(() => {
    if (!open) {
      // 모달이 닫힐 때 상태 초기화
      setGeneratedImage(null);
      setIsGenerating(false);
      setUserEdited(false);
      setIsAutoGenerating(false);
      setGeneratedCount(0);
      autoGenerateRef.current = false;
      return;
    }
    if (userEdited) return;

    const lowerKeyMap = {};
    Object.entries(keywordsByKey || {}).forEach(([k, arr]) => {
      lowerKeyMap[String(k || '').toLowerCase()] = arr || [];
    });

    const positiveVals = [];
    const negativeVals = [];
    let stepsVal = null;
    let cfgVal = null;
    let heightVal = null;
    let widthVal = null;    

    (selectedKeywords || []).forEach((key_val) => {
      const [key, val] = key_val.split(':');
      if (key.toLowerCase() == 'positive') positiveVals.push(val);
      if (key.toLowerCase() == 'negative') negativeVals.push(val);
      if (key.toLowerCase() == 'steps') stepsVal = val;
      if (key.toLowerCase() == 'cfg') cfgVal = val;
      if (key.toLowerCase() == 'height') heightVal = val;
      if (key.toLowerCase() == 'width') widthVal = val;
    });
    setPositive(positiveVals.join(','));
    setNegative(negativeVals.join(','));
    if (stepsVal !== null) setSteps(parseInt(stepsVal, 10));
    if (cfgVal !== null) setCfg(parseFloat(cfgVal));
    if (heightVal !== null) setHeight(parseInt(heightVal, 10));
    if (widthVal !== null) setWidth(parseInt(widthVal, 10));
  }, [open, selectedKeywords, keywordsByKey, userEdited]);

  const submit = async () => {
    try {
      // 자동 생성 중이 아닐 때만 개별 로딩 상태 표시
      if (!isAutoGenerating) {
        setIsGenerating(true);
      }
      setGeneratedImage(null);

      const dna = [];
      (positive || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((value) => dna.push({ key: 'positive', value, direction: 1 }));

      (negative || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((value) => dna.push({ key: 'negative', value, direction: -1 }));

      dna.push({ key: 'steps', value: String(parseInt(steps || 0, 10)), direction: 0 });
      dna.push({ key: 'cfg', value: String(parseFloat(cfg || 0)), direction: 0 });
      dna.push({ key: 'height', value: String(parseInt(height || 0, 10)), direction: 0 });
      dna.push({ key: 'width', value: String(parseInt(width || 0, 10)), direction: 0 });

      const { createImagesBatch } = await import('../../api/api');
      const result = await createImagesBatch([dna]);
      
      // 생성된 이미지 정보 저장
      if (result.data && result.data.length > 0) {
        setGeneratedImage(result.data[0]);
      }
      
      await refreshImages();
    } catch (error) {
      console.error('이미지 생성 중 오류 발생:', error);
      if (!isAutoGenerating) {
        alert('이미지 생성 중 오류가 발생했습니다.');
      }
    } finally {
      if (!isAutoGenerating) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" className="image-gen-modal">
      <Modal.Header>
        <Modal.Title>이미지 생성</Modal.Title>
      </Modal.Header>
      <Modal.Body className="image-gen-modal-body">
        <Stack spacing={24}>
          {/* 생성된 이미지 표시 영역 */}
          {generatedImage && (
            <div className="image-gen-modal-generated-image-container">
              <h4 className="image-gen-modal-generated-image-title">생성된 이미지</h4>
              <img 
                src={`http://localhost:8000/${generatedImage.url}`} 
                alt="Generated" 
                className="image-gen-modal-generated-image"
              />
            </div>
          )}

          {/* 로딩 상태 표시 */}
          {isGenerating && !isAutoGenerating && (
            <div className="image-gen-modal-loading-container">
              <div className="image-gen-modal-loading-title">이미지 생성 중...</div>
              <div className="image-gen-modal-loading-subtitle">잠시만 기다려주세요</div>
            </div>
          )}

          {/* 자동 생성 상태 표시 */}
          {isAutoGenerating && (
            <div className="image-gen-modal-auto-generating-container">
              <div className="image-gen-modal-auto-generating-title">
                🔄 자동 생성 중... ({generatedCount}개 완료)
              </div>
              <div className="image-gen-modal-auto-generating-subtitle">
                무작위 설정으로 이미지를 계속 생성하고 있습니다
              </div>
              <Button 
                appearance="primary" 
                color="red" 
                onClick={stopAutoGeneration}
                size="lg"
                className="image-gen-modal-stop-button"
              >
                ⏹️ 중단
              </Button>
            </div>
          )}

          {/* 폼 영역 */}
          <div className="image-gen-modal-form-grid">
            {/* 키워드 입력 영역 */}
            <div className="image-gen-modal-prompt-section">
              <div className="image-gen-modal-section-header">
                <h5 className="image-gen-modal-section-title">프롬프트 설정</h5>
                <Stack spacing={8}>
                  <Button 
                    size="sm" 
                    appearance="subtle" 
                    onClick={selectRandomAll}
                    disabled={isGenerating || isAutoGenerating}
                    className="image-gen-modal-random-button"
                  >
                    🎲 전체 무작위
                  </Button>
                  <Button 
                    size="sm" 
                    appearance="primary" 
                    onClick={startAutoGeneration}
                    disabled={isGenerating || isAutoGenerating}
                    className="image-gen-modal-auto-start-button"
                  >
                    🔄 자동 생성 시작
                  </Button>
                </Stack>
              </div>
              <Form fluid>
                <Form.Group className="image-gen-modal-form-group">
                  <div className="image-gen-modal-form-group-header">
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      Positive Keywords
                    </Form.ControlLabel>
                    <Button 
                      size="xs" 
                      appearance="ghost" 
                      onClick={selectRandomPositive}
                      disabled={isGenerating || isAutoGenerating}
                      className="image-gen-modal-random-small-button"
                    >
                      🎲 무작위
                    </Button>
                  </div>
                  <Input 
                    value={positive} 
                    onChange={(v) => { setPositive(v); setUserEdited(true); }} 
                    as="textarea" 
                    rows={6}
                    disabled={isGenerating || isAutoGenerating}
                    placeholder="원하는 이미지의 특징을 입력하세요 (예: beautiful, detailed, masterpiece)"
                    className="image-gen-modal-keyword-textarea"
                  />
                </Form.Group>
                <Form.Group className="image-gen-modal-form-group">
                  <div className="image-gen-modal-form-group-header">
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      Negative Keywords
                    </Form.ControlLabel>
                    <Button 
                      size="xs" 
                      appearance="ghost" 
                      onClick={selectRandomNegative}
                      disabled={isGenerating || isAutoGenerating}
                      className="image-gen-modal-random-small-button"
                    >
                      🎲 무작위
                    </Button>
                  </div>
                  <Input 
                    value={negative} 
                    onChange={(v) => { setNegative(v); setUserEdited(true); }} 
                    as="textarea" 
                    rows={6}
                    disabled={isGenerating || isAutoGenerating}
                    placeholder="피하고 싶은 특징을 입력하세요 (예: blurry, low quality, distorted)"
                    className="image-gen-modal-keyword-textarea"
                  />
                </Form.Group>
              </Form>
            </div>

            {/* 설정 영역 */}
            <div className="image-gen-modal-settings-section">
              <div className="image-gen-modal-section-header">
                <h5 className="image-gen-modal-section-title">생성 설정</h5>
                <Button 
                  size="sm" 
                  appearance="subtle" 
                  onClick={selectRandomSettings}
                  disabled={isGenerating || isAutoGenerating}
                  className="image-gen-modal-random-settings-button"
                >
                  🎲 무작위 설정
                </Button>
              </div>
              <Form fluid>
                <div className="image-gen-modal-settings-grid">
                  <Form.Group>
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      Steps (0~50)
                    </Form.ControlLabel>
                    <InputNumber 
                      min={0} 
                      max={50} 
                      step={1} 
                      value={steps} 
                      onChange={(v) => { setSteps(v); setUserEdited(true); }} 
                      style={{ width: '100%' }}
                      disabled={isGenerating || isAutoGenerating}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      CFG (0~10)
                    </Form.ControlLabel>
                    <InputNumber 
                      min={0} 
                      max={10} 
                      step={0.1} 
                      value={cfg} 
                      onChange={(v) => { setCfg(v); setUserEdited(true); }} 
                      style={{ width: '100%' }}
                      disabled={isGenerating || isAutoGenerating}
                    />
                  </Form.Group>
                </div>
                <div className="image-gen-modal-settings-grid">
                  <Form.Group>
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      Height
                    </Form.ControlLabel>
                    <InputNumber 
                      min={64} 
                      step={2} 
                      value={height} 
                      onChange={(v) => { setHeight(v); setUserEdited(true); }} 
                      style={{ width: '100%' }}
                      disabled={isGenerating || isAutoGenerating}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.ControlLabel className="image-gen-modal-form-label">
                      Width
                    </Form.ControlLabel>
                    <InputNumber 
                      min={64} 
                      step={2} 
                      value={width} 
                      onChange={(v) => { setWidth(v); setUserEdited(true); }} 
                      style={{ width: '100%' }}
                      disabled={isGenerating || isAutoGenerating}
                    />
                  </Form.Group>
                </div>
              </Form>
            </div>
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer className="image-gen-modal-footer">
        <Stack justifyContent="space-between" style={{ width: '100%' }}>
          <Button 
            onClick={onClose} 
            disabled={isGenerating || isAutoGenerating}
            size="lg"
            className="image-gen-modal-cancel-button"
          >
            취소
          </Button>
          <Button 
            appearance="primary" 
            onClick={submit}
            loading={isGenerating}
            disabled={isGenerating || isAutoGenerating}
            size="lg"
            className="image-gen-modal-submit-button"
          >
            {isGenerating ? '생성 중...' : '이미지 생성'}
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};
