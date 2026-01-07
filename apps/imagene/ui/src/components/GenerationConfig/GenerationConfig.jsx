import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import './GenerationConfig.css';
import ResolutionEditModal from './ResolutionEditModal';
import NegativeKeywordsModal from './NegativeKeywordsModal';
import { useImageFilter } from '../../contexts/ImageFilterContext';
export const env = import.meta.env;

// GenerationConfig 컴포넌트
const GenerationConfig = () => {

    const { generationConfig, setGenerationConfig, saveGenerationConfig, resetGenerationConfig } = useImageFilter();
    const [modalState, setModalState] = useState({
        isOpen: false,
        editingIndex: null,
        editingResolution: null
    });

    const [negativeKeywordsModal, setNegativeKeywordsModal] = useState({
        isOpen: false
    });


  const handleConfigChange = (key, value) => {
    setGenerationConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSeedRangeChange = (index, value) => {
    const newRange = [...generationConfig.seedRange];
    newRange[index] = parseInt(value) || 0;
    setGenerationConfig(prev => ({
      ...prev,
      seedRange: newRange
    }));
  };

  const handleResolutionChange = (index, dimension, value) => {
    const newResolutions = [...generationConfig.resolution_options];
    newResolutions[index] = [...newResolutions[index]];
    newResolutions[index][dimension] = parseInt(value) || 768;
    setGenerationConfig(prev => ({
      ...prev,
      resolution_options: newResolutions
    }));
  };

  const addResolution = () => {
    setGenerationConfig(prev => ({
      ...prev,
      resolution_options: [...prev.resolution_options, [768, 1024]]
    }));
  };

  const removeResolution = (index) => {
    if (generationConfig.resolution_options.length > 1) {
      setGenerationConfig(prev => ({
        ...prev,
        resolution_options: prev.resolution_options.filter((_, i) => i !== index)
      }));
    }
  };

  const openResolutionModal = (index) => {
    setModalState({
      isOpen: true,
      editingIndex: index,
      editingResolution: generationConfig.resolution_options[index]
    });
  };

  const closeResolutionModal = () => {
    setModalState({
      isOpen: false,
      editingIndex: null,
      editingResolution: null
    });
  };

  const saveResolution = (index, newResolution) => {
    const newResolutions = [...generationConfig.resolution_options];
    newResolutions[index] = newResolution;
    setGenerationConfig(prev => ({
      ...prev,
      resolution_options: newResolutions
    }));
  };

  const deleteResolution = (index) => {
    if (generationConfig.resolution_options.length > 1) {
      const newResolutions = generationConfig.resolution_options.filter((_, i) => i !== index);
      setGenerationConfig(prev => ({
        ...prev,
        resolution_options: newResolutions
      }));
    }
  };

  const openNegativeKeywordsModal = () => {
    setNegativeKeywordsModal({ isOpen: true });
  };

  const closeNegativeKeywordsModal = () => {
    setNegativeKeywordsModal({ isOpen: false });
  };

  const saveNegativeKeywords = (keywords) => {
    setGenerationConfig(prev => ({
      ...prev,
      negative_keywords: keywords
    }));
  };

  const handleSaveConfig = () => {
    if (window.confirm('설정을 웹브라우저에 저장하시겠습니까?')) {
      saveGenerationConfig();
      alert('설정이 저장되었습니다.');
    }
  };

  const getNegativeKeywordsPreview = () => {
    const keywords = generationConfig.negative_prompt.split(',').map(k => k.trim());
    const totalCount = keywords.length;
    const preview = keywords.slice(0, 3).join(', ');
    return {
      preview: preview + (totalCount > 3 ? '...' : ''),
      count: totalCount
    };
  };

  return (
    <div className="generation-config">
      <div className="config-header">
        <h3>Generation Config</h3>
        <div className="button-group">
          <button 
            type="button" 
            onClick={handleSaveConfig}
            className="save-config-btn"
          >
            저장
          </button>
          <button 
            type="button" 
            onClick={resetGenerationConfig}
            className="reset-config-btn"
          >
            기본값
          </button>
        </div>
      </div>
    
    <div className="config-section compact">
        <div className="toggle-group">
            <div className="toggle-item" title="사용자가 입력한 프롬프트에 기존 디렉토리의 프롬프트를 무작위로 추가합니다">
                <label className="toggle-label">기존 프롬프트</label>
                <button
                    type="button"
                    className={`toggle-btn ${generationConfig.useDirectoryPrompt===true ? 'active' : ''}`}
                    onClick={() => handleConfigChange('useDirectoryPrompt', !generationConfig.useDirectoryPrompt)}
                >
                    <span className="toggle-slider"></span>
                </button>
            </div>
            <div className="toggle-item" title="기존 디렉토리의 이미지를 사용하여 이미지 생성을 시작합니다">
                <label className="toggle-label">기존 이미지</label>
                <button
                    type="button"
                    className={`toggle-btn ${generationConfig.useDirectoryImage===true ? 'active' : ''}`}
                    onClick={() => handleConfigChange('useDirectoryImage', !generationConfig.useDirectoryImage)}
                >
                    <span className="toggle-slider"></span>
                </button>
            </div>
        
        </div>
        
        <div className="strength-control" title="기존 이미지에 얼마나 많은 변화를 줄지 결정합니다 (0.0: 원본과 동일, 1.0: 완전히 새로운 이미지)">
            <label className="strength-label">변화 강도 </label>
            <input
                type="number"
                value={generationConfig.useImageStrength}
                onChange={(e) => handleConfigChange('useImageStrength', parseFloat(e.target.value) || 0.85)}
                min="0.0"
                max="1.0"
                step="0.05"
                disabled={!generationConfig.useDirectoryImage}
                className={!generationConfig.useDirectoryImage ? 'disabled' : ''}
            />
        </div>

        <div className="strength-control" title="프롬프트에 무작위로 새로운 단어를 추가합니다.">
          <label>
            Mutation
            <input
              type="number"
              value={generationConfig.mutation}
              onChange={(e) => handleConfigChange('mutation', parseInt(e.target.value) || 0)}
              min="0"
              max="32"
            />
          </label>
        </div>

    </div>

      <div className="config-section compact">
        <label>
          CFG
          <input
            type="number"
            value={generationConfig.cfg}
            onChange={(e) => handleConfigChange('cfg', parseFloat(e.target.value) || 10)}
            min="1"
            max="20"
            step="0.1"
          />
        </label>
        <label>
          Steps
          <input
            type="number"
            value={generationConfig.steps}
            onChange={(e) => handleConfigChange('steps', parseInt(e.target.value) || 30)}
            min="1"
            max="100"
          />
        </label>
        <label>
          Batch
          <input
            type="number"
            value={generationConfig.maxChunkSize}
            onChange={(e) => handleConfigChange('maxChunkSize', parseInt(e.target.value) || 16)}
            min="1"
            max="32"
          />
        </label>
        <label>
          nGen
          <input
            type="number"
            value={generationConfig.ngen}
            onChange={(e) => handleConfigChange('ngen', parseInt(e.target.value) || 2)}
            min="1"
            max="10"
          />
        </label>
      </div>

      <div className="config-section">
        <label>Resolutions</label>
        <div className="resolution-buttons">
          {generationConfig.resolution_options.map((resolution, index) => (
            <button
              key={index}
              className="resolution-btn"
              onClick={() => openResolutionModal(index)}
              title={`${resolution[0]} × ${resolution[1]}`}
            >
              {resolution[0]} × {resolution[1]}
            </button>
          ))}
          <button type="button" onClick={addResolution} className="add-resolution-btn">
            + Add
          </button>
        </div>
      </div>

      <div className="config-section">
        <label>Negative Prompt</label>
        <div className="negative-keywords-preview">
          <div className="keywords-preview-content">
            <span className="keywords-text">{getNegativeKeywordsPreview().preview}</span>
            <span className="keywords-count">({getNegativeKeywordsPreview().count}개)</span>
          </div>
          <button 
            type="button" 
            onClick={openNegativeKeywordsModal}
            className="edit-keywords-btn"
          >
            편집
          </button>
        </div>
      </div>

      <ResolutionEditModal
        isOpen={modalState.isOpen}
        onClose={closeResolutionModal}
        onSave={saveResolution}
        onDelete={deleteResolution}
        resolution={modalState.editingResolution}
        index={modalState.editingIndex}
      />

      <NegativeKeywordsModal
        isOpen={negativeKeywordsModal.isOpen}
        onClose={closeNegativeKeywordsModal}
        onSave={saveNegativeKeywords}
        negativeKeywords={generationConfig.negative_prompt}
      />
    </div>
  );
};

export default GenerationConfig;
