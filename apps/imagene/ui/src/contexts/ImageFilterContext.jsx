import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDirectory
} from '../api/api';
export const env = import.meta.env;

// URL 파라미터 관리 유틸리티 함수들
const getUrlParam = (key) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
};

const setUrlParam = (key, value) => {
  const url = new URL(window.location);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, '', url);
};

const defaultFilter = {
  group_ids: [],
  search_value: '',
  limit: 1000,
  offset: 0,
};

const DEFAULT_GENERATION_CONFIG = {
    modelPath: env.VITE_SD_MODEL_PATH,
    seedRange: [0, 2000000000], 
    useDirectoryImage: true,
    useImageStrength: 0.999,
    useDirectoryPrompt: true,
    mutation: 1,
    cfg: 10, 
    steps: 30, 
    maxChunkSize: 16,
    ngen: 2,    
    resolution_options: [[768, 1024], [768, 1280], [1024, 768], [1024, 1024], [1024, 1280], [1280, 768], [1280, 1024], [1280, 1280], [1536, 1280]], 
    positive_prompt_length_limit: 35,
    negative_prompt_length_limit: 35, 
    negative_prompt: 'blurry, low quality, bad anatomy, disfigured, deformed, bad hands, missing fingers, extra fingers, worst quality, jpeg artifacts, signature, watermark, text, bad eyes, grotesque, sketchy, logo, rough, incomplete, disgusting, distorted, deformed face, poorly drawn, bad quality', 
}


const ImageFilterContext = createContext(null);

export const ImageFilterProvider = ({ children }) => {
  const [directory, setDirectoryState] = useState(() => {
    const pathFromUrl = getUrlParam('path');
    return { path: pathFromUrl || '/' };
  });
  const [subDirs, setSubDirs] = useState([]);

  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [images, setImages] = useState([]);
  const [imageKeywords, setImageKeywords] = useState({});  

  const [hoveredImage, setHoveredImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [userPrompt, setUserPrompt] = useState('');
  const [generationConfig, setGenerationConfig] = useState(DEFAULT_GENERATION_CONFIG);

  useEffect(() => {
    const savedGenerationConfig = localStorage.getItem('imagene-generation-config');
    if (savedGenerationConfig) {
        try {
        setGenerationConfig(JSON.parse(savedGenerationConfig));
        } catch (error) {
        console.warn('로컬스토리지에서 생성 설정을 불러올 수 없습니다:', error);
        }
    }
    }, []);

    const saveGenerationConfig = useCallback(() => {
    try {
        localStorage.setItem('imagene-generation-config', JSON.stringify(generationConfig));
    } catch (error) {
        console.warn('로컬스토리지에 생성 설정을 저장할 수 없습니다:', error);
    }
    }, [generationConfig]);

    const resetGenerationConfig = useCallback(() => {
    setGenerationConfig(DEFAULT_GENERATION_CONFIG);
    }, []);

  useEffect(() => {
    refreshDirectory();
    setSelectedImageIds(new Set());
  }, [directory]);

  useEffect(() => {
    const kd = {};
    const maxCount = images.length;
    for (const img of images) {
      for (let keyword of img.positive_prompt.split(',')) {          
        keyword = keyword.trim();
        if (!kd[keyword]) {
          kd[keyword] = 0;
        }
        kd[keyword]+=1/maxCount;
      }
    }
    setImageKeywords(kd);    
  }, [images]);

  // 디렉토리 변경 시 URL에 저장하는 함수
  const setDirectory = useCallback((newDirectory) => {
    setDirectoryState(newDirectory);
    setUrlParam('path', newDirectory.path);
  }, []);


  const refreshDirectory = useCallback(async () => {
    const { data } = await getDirectory(directory.path);
    setSubDirs(data.sub_dirs);
    setImages(data.images);  
  }, [directory]);



  const value = useMemo(() => ({
    refreshDirectory,
    images,
    setImages,
    hoveredImage,
    setHoveredImage,
    imageKeywords,
    directory,
    setDirectory,
    subDirs,
    setSubDirs,
    selectedImageIds,
    setSelectedImageIds,
    userPrompt,
    setUserPrompt,
    generationConfig,
    setGenerationConfig,
    saveGenerationConfig,
    resetGenerationConfig,
    isGenerating,
    setIsGenerating,
  }), [
    refreshDirectory,
    images,
    setImages,
    hoveredImage,
    setHoveredImage,
    imageKeywords,
    directory,
    setDirectory,
    subDirs,
    setSubDirs,
    selectedImageIds,
    setSelectedImageIds,
    userPrompt,
    setUserPrompt,
    generationConfig,
    setGenerationConfig,
    saveGenerationConfig,
    resetGenerationConfig,
    isGenerating,
    setIsGenerating,
  ]);

  return (
    <ImageFilterContext.Provider value={value}>
      {children}
    </ImageFilterContext.Provider>
  );
};

export const useImageFilter = () => {
  const ctx = useContext(ImageFilterContext);
  if (!ctx) throw new Error('useImageFilter must be used within ImageFilterProvider');
  return ctx;
};


