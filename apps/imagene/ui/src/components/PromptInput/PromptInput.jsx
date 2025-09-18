import React from 'react';
import { Button, Input } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { searchFromPrompt } from '../../api/api';

export const PromptInput = () => {
  const {
    setImages,
    imageKeywords,
    userPrompt,
    setUserPrompt,
  } = useImageFilter();

  // 확률에 따라 키워드를 무작위로 선택하는 함수
  const generateRandomPrompt = () => {
    if (!imageKeywords || Object.keys(imageKeywords).length === 0) {
      return '';
    }

    const keywords = Object.keys(imageKeywords);
    const selectedKeywords = [];

    // 각 키워드에 대해 확률에 따라 선택
    keywords.forEach(keyword => {
      const probability = imageKeywords[keyword];
      if (Math.random() < probability) {
        selectedKeywords.push(keyword);
      }
    });

    // 키워드 순서를 셔플
    for (let i = selectedKeywords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedKeywords[i], selectedKeywords[j]] = [selectedKeywords[j], selectedKeywords[i]];
    }

    return selectedKeywords.join(', ');
  };

  const handleRandomSelect = () => {
    setUserPrompt(''); // 기존 프롬프트 초기화
    const randomPrompt = generateRandomPrompt();
    setUserPrompt(randomPrompt);
  };

  const handleSearchFromPrompt = () => {
    searchFromPrompt(userPrompt).then(response => {
      setImages(response.data.similar_images);
    });
  };

  return (
    <div className="content-area-toolbar">
      <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
        <Input
          as="textarea"
          placeholder="프롬프트를 입력하세요..."
          value={userPrompt}
          onChange={(value) => setUserPrompt(value)}
          rows={5}
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button
          appearance="primary"
          onClick={handleRandomSelect}
          style={{ alignSelf: 'flex-start' }}
        >
          무작위 선택
        </Button>
        <Button
          appearance="primary"
          onClick={handleSearchFromPrompt}
          style={{ alignSelf: 'flex-start' }}
        >
            이미지 찾기
          </Button>
        </div>
      </div>
    </div>
  );
};
