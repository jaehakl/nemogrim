import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Button, Stack, Form, InputNumber, Input, Slider, CheckPicker, Divider, Card } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { AutoGenerationModal } from './AutoGenerationModal';
import { generateOffsprings } from './imageGeneration';

export const ImageGenerator = () => {
  const {
    directory,
    images,
    imageKeywords,
    userPrompt,
    generationConfig,
    refreshDirectory,
  } = useImageFilter();
  
  const [showAutoGenerationModal, setShowAutoGenerationModal] = useState(false);

  const handleGenerateOffsprings = async () => {
    try {
      await generateOffsprings({
        directory,
        images,
        imageKeywords,
        userPrompt,
        generationConfig,
        refreshDirectory
      });
    } catch (error) {
      console.error('이미지 생성 실패:', error);
    }
  };

  return (
    <div>
      <Button 
        onClick={() => setShowAutoGenerationModal(true)}
        color="blue"
        appearance="primary"
      >
        자동 생성 시작
      </Button>
      <Button 
        onClick={handleGenerateOffsprings}
        style={{ marginLeft: '10px' }}
      >
        한 번 생성
      </Button>
      
      <AutoGenerationModal 
        show={showAutoGenerationModal}
        onClose={() => setShowAutoGenerationModal(false)}
      />
    </div>
  );
};
