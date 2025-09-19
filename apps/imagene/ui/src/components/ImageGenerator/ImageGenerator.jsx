import React, { useState } from 'react';
import { Button } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { AutoGenerationModal } from './AutoGenerationModal';
import { generateOffsprings } from './imageGeneration';

export const ImageGenerator = ({ uploadedFiles, setUploadedFiles, previewImages, setPreviewImages }) => {
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
        uploadedFiles,
        generationConfig,
        refreshDirectory
      });
    } catch (error) {
      console.error('이미지 생성 실패:', error);
    }
  };


  return (
    <div style={{ padding: '20px' }}>
      {/* 이미지 생성 버튼들 */}
      <div style={{ marginBottom: '20px' }}>
        <Button 
          onClick={() => setShowAutoGenerationModal(true)}
          color="blue"
          appearance="primary"
          style={{ marginRight: '10px' }}
        >
          자동 생성 시작
        </Button>
        <Button 
          onClick={handleGenerateOffsprings}
        >
          한 번 생성
        </Button>
      </div>
      
      <AutoGenerationModal 
        show={showAutoGenerationModal}
        onClose={() => setShowAutoGenerationModal(false)}
      />
    </div>
  );
};
