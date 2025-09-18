import React, { useEffect } from 'react';
import { Modal, Button, Stack, Progress, Loader } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { generateOffsprings } from './imageGeneration';

export const AutoGenerationModal = ({ show, onClose }) => {
  const {
    directory,
    images,
    imageKeywords,
    userPrompt,
    generationConfig,
    refreshDirectory,
  } = useImageFilter();

  const handleGenerateOffsprings = async () => {
    try {
      await generateOffsprings({
        directory,
        images,
        imageKeywords,
        userPrompt,
        generationConfig,
        refreshDirectory,
        onComplete: () => {
          // 모달이 열려있는 동안 계속 생성
          if (show) {        
            handleGenerateOffsprings();
          }
        }
      });
    } catch (error) {
      console.error('이미지 생성 실패:', error);
    }
  };

  useEffect(() => {
    if (show) {
      handleGenerateOffsprings();
    }
  }, [show]);

  return (
    <Modal 
      open={show} 
      onClose={onClose}
      size="sm"
      backdrop="static"
    >
      <Modal.Header>
        <Modal.Title>자동 이미지 생성 중...</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack direction="column" spacing={20} alignItems="center">
          <Loader size="lg" />
          <div>
            <p>이미지를 자동으로 생성하고 있습니다.</p>
            <p>모달을 닫으면 생성이 중단됩니다.</p>
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose} color="red" appearance="primary">
          생성 중단
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
