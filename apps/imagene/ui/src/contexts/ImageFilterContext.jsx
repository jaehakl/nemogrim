import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getDirectory,
  setImageDirectoryBatch,
  getGroup,
  filterImages,
  getGroupPreviewBatch,
  deleteImagesBatch,
  setImageGroupBatch,
  unsetImageGroupBatch,
  deleteKeywordsBatch,
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


  const [selectedImage, setSelectedImage] = useState(null);

  const [userPrompt, setUserPrompt] = useState('');
  const [generationConfig, setGenerationConfig] = useState(DEFAULT_GENERATION_CONFIG);


  const [imageFilterData, setImageFilterData] = useState(defaultFilter);
  const [groupPreview, setGroupPreview] = useState([]);
  const [keywordsByKey, setKeywordsByKey] = useState({});
  const [groupKeywords, setGroupKeywords] = useState({});
  const [selectedKeywords, setSelectedKeywords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const refreshImages = useCallback(async (overrideFilter) => {
    setLoading(true);    
    setError(null);
    try {
      const payload = overrideFilter || imageFilterData;      
      const { data } = await filterImages(payload);      
      setImages(data || []);

      setSelectedImageIds(new Set());
    } catch (e) {
      setError(e?.message || '이미지 로딩 오류');
    } finally {
      setLoading(false);
    }
  }, [imageFilterData]);

  const refreshGroupPreview = useCallback(async () => {
    try {
      const { data } = await getGroupPreviewBatch();
      const keywordsDict = {};
      const groupKeywords = {};
      data.forEach(group => {
        groupKeywords[group.id] = {};
        Object.values(group.keywords).forEach(keyword => {
          groupKeywords[group.id][keyword.id] = keyword;
          if (!keywordsDict[keyword.key]) {
            keywordsDict[keyword.key] = {};
          }
          if (!keywordsDict[keyword.key][keyword.id]) {
            keywordsDict[keyword.key][keyword.id] = keyword;
          }
        });
      });
      
      setGroupKeywords(groupKeywords);
      setGroupPreview(data || []);
    } catch (e) {
      // 실패해도 치명적이지 않음
    }
  }, []);


  useEffect(() => {
    const keywordKeys = {};
    const group_ids = imageFilterData.group_ids.length > 0 ? imageFilterData.group_ids : Object.keys(groupKeywords);
    group_ids.forEach(group_id => {
      Object.entries(groupKeywords[group_id] || {}).forEach(([key, kw]) => {
          if (!keywordKeys[kw.key]) {
            keywordKeys[kw.key] = {};
          }
          keywordKeys[kw.key][kw.id] = { ...kw, label: kw.value, item_value: `${kw.key}:${kw.value}`};
        });
    });
    setKeywordsByKey(keywordKeys);
  }, [imageFilterData, groupKeywords]);

  useEffect(() => {
    setImageFilterData((prev) => ({ ...prev, keywords: Object.values(selectedKeywords) }));
  }, [selectedKeywords]);

  const toggleGroupId = useCallback((groupId) => {
    setImageFilterData((prev) => {
      const set = new Set(prev.group_ids || []);
      if (set.has(groupId)) set.delete(groupId); else set.add(groupId);      
      return { ...prev, group_ids: Array.from(set), offset: 0 };
    });
  }, []);


  const clearSelection = useCallback(() => setSelectedImageIds(new Set()), []);

  const toggleSelectImage = useCallback((imageId) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId); else next.add(imageId);
      return next;
    });
  }, []);

  const bulkDelete = useCallback(async () => {
    if (selectedImageIds.size === 0) return;
    try {
      await deleteImagesBatch(Array.from(selectedImageIds));
      clearSelection();
      await refreshImages();
      await refreshGroupPreview();
    } catch (e) {
      setError(e?.message || '삭제 실패');
    }
  }, [selectedImageIds, refreshImages, refreshGroupPreview, clearSelection]);

  const bulkSetGroup = useCallback(async ({groupId = null, groupName = null}) => {
    if (!groupId && !groupName || selectedImageIds.size === 0) return;
    try {
      await setImageGroupBatch({ group_id: groupId, group_name: groupName, image_ids: Array.from(selectedImageIds) });
      clearSelection();
      await refreshImages();
      await refreshGroupPreview();
    } catch (e) {
      setError(e?.message || '그룹 설정 실패');
    }
  }, [selectedImageIds, refreshImages, refreshGroupPreview, clearSelection]);

  const bulkUnsetGroup = useCallback(async () => {
    const groupIds = imageFilterData.group_ids;
    if (!groupIds || selectedImageIds.size === 0) return;
    try {
      await unsetImageGroupBatch({ group_ids: groupIds, image_ids: Array.from(selectedImageIds) });
      clearSelection();
      await refreshImages();
      await refreshGroupPreview();
    } catch (e) {
      setError(e?.message || '그룹 해제 실패');
    }
  }, [selectedImageIds, refreshImages, refreshGroupPreview, clearSelection]);

  const bulkDeleteKeywords = useCallback(async () => {
    if (Object.keys(selectedKeywords || {}).length === 0) return;
    try {
      // 선택된 키워드들의 ID를 찾아서 삭제
      const keywordIds = Object.keys(selectedKeywords || {}).map(id => parseInt(id));            
      if (keywordIds.length > 0) {
        await deleteKeywordsBatch(keywordIds);
        setSelectedKeywords({});
        setImageFilterData((prev) => ({ ...prev, search_value: '', offset: 0 }));
        await refreshImages();
      }
    } catch (e) {
      setError(e?.message || '키워드 삭제 실패');
    }
  }, [selectedKeywords, refreshImages]);


  const value = useMemo(() => ({
    imageFilterData,
    setImageFilterData,
    groupPreview,
    keywordsByKey,
    groupKeywords,
    selectedKeywords,
    loading,
    error,
    // actions
    refreshImages,
    refreshGroupPreview,
    toggleGroupId,
    setSelectedKeywords,
    toggleSelectImage,
    clearSelection,
    bulkDelete,
    bulkSetGroup,
    bulkUnsetGroup,
    bulkDeleteKeywords,

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
    imageFilterData,
    groupPreview,
    keywordsByKey,
    groupKeywords,
    selectedKeywords,
    loading,
    error,

    refreshImages,
    refreshGroupPreview,
    toggleGroupId,
    setSelectedKeywords,
    toggleSelectImage,
    clearSelection,
    bulkDelete,
    bulkSetGroup,
    bulkUnsetGroup,
    bulkDeleteKeywords,

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


