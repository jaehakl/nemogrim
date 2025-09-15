import React, { useState, useEffect } from 'react';
import { Button, Stack, Form, SelectPicker, Divider, Card, Input, Modal, InputGroup } from 'rsuite';
import prompt_generating from '../service/prompt_generating.json';
import './PromptGenerator.css';

export const PromptGenerator = ({ onPromptChange, disabled = false, show, onClose }) => {
  const [selectedKeywords, setSelectedKeywords] = useState({});
  const [shuffledOptions, setShuffledOptions] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  // 초기화 및 랜덤 선택
  useEffect(() => {
    if (show) {
      initializeRandomSelections();
    }
  }, [show]);

  // 초기 랜덤 선택
  const initializeRandomSelections = () => {
    const newSelected = {};
    const newShuffled = {};
    const newCustomInputs = {};

    Object.entries(prompt_generating).forEach(([category, categoryData]) => {
      newSelected[category] = {};
      newShuffled[category] = {};
      newCustomInputs[category] = {};

      Object.entries(categoryData).forEach(([key, values]) => {
        if (Array.isArray(values) && values.length > 0) {
          // 쉼표로 분리된 값들을 배열로 변환
          const valueArray = values.flatMap(value => 
            typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value]
          ).filter(v => v.length > 0);

          // 랜덤 셔플
          const shuffled = [...valueArray].sort(() => 0.5 - Math.random());
          newShuffled[category][key] = shuffled;

          // 랜덤 선택
          const randomIndex = Math.floor(Math.random() * shuffled.length);
          newSelected[category][key] = shuffled[randomIndex];
        }
        newCustomInputs[category][key] = '';
      });
    });

    setSelectedKeywords(newSelected);
    setShuffledOptions(newShuffled);
    setCustomInputs(newCustomInputs);
  };

  // 특정 카테고리 셔플
  const shuffleCategory = (category) => {
    const newShuffled = { ...shuffledOptions };
    const newSelected = { ...selectedKeywords };

    Object.entries(prompt_generating[category] || []).forEach(([key, values]) => {        
      if (Array.isArray(values) && values.length > 0) {
        const valueArray = values.flatMap(value => 
          typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value]
        ).filter(v => v.length > 0);

        const shuffled = [...valueArray].sort(() => 0.5 - Math.random());
        newShuffled[category][key] = shuffled;

        const randomIndex = Math.floor(Math.random() * shuffled.length);
        newSelected[category][key] = shuffled[randomIndex];
        }
    });

    setShuffledOptions(newShuffled);
    setSelectedKeywords(newSelected);
  };

  // 특정 키 셔플
  const shuffleKey = (category, key) => {
    const newShuffled = { ...shuffledOptions };
    const newSelected = { ...selectedKeywords };

    const values = prompt_generating[category]?.[key];
    if (Array.isArray(values) && values.length > 0) {
      const valueArray = values.flatMap(value => 
        typeof value === 'string' ? value.split(',').map(v => v.trim()) : [value]
      ).filter(v => v.length > 0);

      const shuffled = [...valueArray].sort(() => 0.5 - Math.random());
      newShuffled[category][key] = shuffled;
      
      const randomIndex = Math.floor(Math.random() * shuffled.length);
      newSelected[category][key] = shuffled[randomIndex];

      setShuffledOptions(newShuffled);
      setSelectedKeywords(newSelected);
    }
  };

  // 전체 셔플
  const shuffleAll = () => {
    initializeRandomSelections();
  };

  // 키워드 선택 변경
  const handleKeywordChange = (category, key, value) => {
    const newSelected = {
      ...selectedKeywords,
      [category]: {
        ...selectedKeywords[category],
        [key]: value
      }
    };
    setSelectedKeywords(newSelected);
  };

  // 키워드 제거
  const clearKeyword = (category, key) => {
    const newSelected = {
      ...selectedKeywords,
      [category]: {
        ...selectedKeywords[category],
        [key]: ''
      }
    };
    setSelectedKeywords(newSelected);
  };

  // 커스텀 입력 변경
  const handleCustomInputChange = (category, key, value) => {
    const newCustomInputs = {
      ...customInputs,
      [category]: {
        ...customInputs[category],
        [key]: value
      }
    };
    setCustomInputs(newCustomInputs);
  };

  // 커스텀 입력 추가
  const addCustomInput = (category, key) => {
    const customValue = customInputs[category]?.[key];
    if (customValue && customValue.trim() !== '') {
      const newSelected = {
        ...selectedKeywords,
        [category]: {
          ...selectedKeywords[category],
          [key]: customValue.trim()
        }
      };
      setSelectedKeywords(newSelected);
      
      // 커스텀 입력 초기화
      const newCustomInputs = {
        ...customInputs,
        [category]: {
          ...customInputs[category],
          [key]: ''
        }
      };
      setCustomInputs(newCustomInputs);
    }
  };

  // positive_keywords 형식으로 변환
  const convertToPositiveKeywordsFormat = (selected) => {
    const keywordPairs = [];

    Object.entries(selected).forEach(([category, categoryData]) => {
      Object.entries(categoryData).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          // 카테고리와 키를 조합하여 키 생성
          const keywordKey = `${category}_${key}`;
          keywordPairs.push(`{${keywordKey}: ${value}}`);
        }
      });
    });
    return keywordPairs.join(', ');
  };

  // 확인 버튼 클릭 핸들러
  const handleConfirm = () => {
    const formattedKeywords = convertToPositiveKeywordsFormat(selectedKeywords);
    if (onPromptChange) {
      onPromptChange(formattedKeywords);
    }
    if (onClose) {
      onClose();
    }
  };

  // 카테고리별 렌더링
  const renderCategory = (category, categoryData) => {
    const categoryName = {
      statement: '문장 구조',
      status: '상태',
      fashion: '패션',
      body: '신체',
      scene: '장면'
    }[category] || category;

    return (
      <div key={category} className="prompt-generator-category">
        <div className="prompt-generator-category-header">
          <h6 className="prompt-generator-category-title">{categoryName}</h6>
          <Button
            size="xs"
            appearance="ghost"
            onClick={() => shuffleCategory(category)}
            disabled={disabled}
            className="prompt-generator-shuffle-button"
          >
            🔀 셔플
          </Button>
        </div>
        
        <div className="prompt-generator-category-content">
          {Object.entries(categoryData).map(([key, values]) => {
            if (!Array.isArray(values) || values.length === 0) return null;

            const keyName = {
              subject: '주어',
              verb: '동사',
              object: '목적어',
              adverb: '부사',
              emotion: '감정',
              pose: '자세',
              state: '상태',
              clothesState: '의상 상태',
              clothes: '의상',
              shoes: '신발',
              accessory: '액세서리',
              item: '아이템',
              character: '캐릭터',
              feature: '특징',
              hairStyle: '헤어스타일',
              hairColor: '머리색',
              eyes: '눈',
              skin: '피부',
              background: '배경',
              camera: '카메라',
              mood: '분위기',
              style: '스타일',
              quality: '품질'
            }[key] || key;

            const options = shuffledOptions[category]?.[key] || [];
            const data = options.map(value => ({ label: value, value }));

            return (
              <div key={key} className="prompt-generator-key-group">
                <div className="prompt-generator-key-header">
                  <span className="prompt-generator-key-label">{keyName}</span>
                  <div className="prompt-generator-key-buttons">
                    <Button
                      size="xs"
                      appearance="ghost"
                      onClick={() => clearKeyword(category, key)}
                      disabled={disabled || !selectedKeywords[category]?.[key]}
                      className="prompt-generator-key-clear-button"
                      title="선택된 값 제거"
                    >
                      ✕
                    </Button>
                    <Button
                      size="xs"
                      appearance="ghost"
                      onClick={() => shuffleKey(category, key)}
                      disabled={disabled}
                      className="prompt-generator-key-shuffle-button"
                      title="랜덤 선택"
                    >
                      🔀
                    </Button>
                  </div>
                </div>
                <SelectPicker
                  data={data}
                  value={selectedKeywords[category]?.[key] || ''}
                  onChange={(value) => handleKeywordChange(category, key, value)}
                  disabled={disabled}
                  searchable={false}
                  cleanable={false}
                  className="prompt-generator-select"
                  placeholder={`${keyName} 선택`}
                />
                <div className="prompt-generator-custom-input-group">
                  <InputGroup>
                    <Input
                      placeholder={`${keyName} 직접 입력`}
                      value={customInputs[category]?.[key] || ''}
                      onChange={(value) => handleCustomInputChange(category, key, value)}
                      disabled={disabled}
                      className="prompt-generator-custom-input"
                      onPressEnter={() => addCustomInput(category, key)}
                    />
                    <InputGroup.Button
                      onClick={() => addCustomInput(category, key)}
                      disabled={disabled || !customInputs[category]?.[key]?.trim()}
                      className="prompt-generator-add-button"
                      title="입력한 값 추가"
                    >
                      +
                    </InputGroup.Button>
                  </InputGroup>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={show}
      onClose={onClose}
      size="lg"
      className="prompt-generator-modal"
    >
      <Modal.Header>
        <Modal.Title>프롬프트 생성기</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <div className="prompt-generator-content">
          {/* 전체 셔플 버튼 */}
          <div className="prompt-generator-header">
            <Button
              size="sm"
              appearance="primary"
              onClick={shuffleAll}
              disabled={disabled}
              className="prompt-generator-shuffle-all-button"
            >
              🔀 전체 셔플
            </Button>
          </div>

          <Divider />

          {/* 카테고리별 키워드 선택 */}
          <div className="prompt-generator-categories">
            {Object.entries(prompt_generating).map(([category, categoryData]) => 
              renderCategory(category, categoryData)
            )}
          </div>

          <Divider />
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button onClick={onClose} appearance="subtle">
          취소
        </Button>
        <Button onClick={handleConfirm} appearance="primary">
          확인
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
