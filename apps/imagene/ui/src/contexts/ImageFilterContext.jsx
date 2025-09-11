import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  filterImages,
  getGroupPreviewBatch,
  sortKeywordsByKey,
  deleteImagesBatch,
  setImageGroupBatch,
  deleteKeywordsBatch,
} from '../api/api';

const defaultFilter = {
  group_names: [],
  search_value: '',
  limit: 1000,
  offset: 0,
};

const ImageFilterContext = createContext(null);

export const ImageFilterProvider = ({ children }) => {
  const [imageFilterData, setImageFilterData] = useState(defaultFilter);
  const [imagesByGroup, setImagesByGroup] = useState({});
  const [groupPreview, setGroupPreview] = useState({});
  const [keywordsByKey, setKeywordsByKey] = useState({});
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshImages = useCallback(async (overrideFilter) => {
    setLoading(true);
    setError(null);
    try {
      const payload = overrideFilter || imageFilterData;      
      const { data } = await filterImages(payload);
      setImagesByGroup(data || {});
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
      setGroupPreview(data || {});
    } catch (e) {
      // 실패해도 치명적이지 않음
    }
  }, []);

  const refreshKeywords = useCallback(async () => {
    try {
      const { data } = await sortKeywordsByKey();
      setKeywordsByKey(data || {});
    } catch (e) {
      // 실패해도 치명적이지 않음
    }
  }, []);

  useEffect(() => {
    refreshImages();
    // 초기 사이드바 데이터
    refreshGroupPreview();
    refreshKeywords();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 필터 변경 시 목록 새로고침
    refreshImages();
  }, [imageFilterData, refreshImages]);

  const toggleGroupName = useCallback((groupName) => {
    setImageFilterData((prev) => {
      const set = new Set(prev.group_names || []);
      if (set.has(groupName)) set.delete(groupName); else set.add(groupName);      
      return { ...prev, group_names: Array.from(set), offset: 0 };
    });
  }, []);

  const setSearchFromKeywords = useCallback((selectedValues) => {
    const cleaned = selectedValues
      .map(v => String(v || '').trim())
      .filter(Boolean);
    setSelectedKeywords(cleaned);
    setImageFilterData((prev) => ({ ...prev, search_value: cleaned.join(','), offset: 0 }));
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

  const bulkSetGroup = useCallback(async (groupName) => {
    if (!groupName || selectedImageIds.size === 0) return;
    try {
      await setImageGroupBatch({ group_name: groupName, image_ids: Array.from(selectedImageIds) });
      clearSelection();
      await refreshImages();
      await refreshGroupPreview();
    } catch (e) {
      setError(e?.message || '그룹 설정 실패');
    }
  }, [selectedImageIds, refreshImages, refreshGroupPreview, clearSelection]);

  const bulkDeleteKeywords = useCallback(async () => {
    if (selectedKeywords.length === 0) return;
    try {
      // 선택된 키워드들의 ID를 찾아서 삭제
      const keywordIds = [];
      Object.entries(keywordsByKey || {}).forEach(([key, keywords]) => {
        keywords.forEach(kw => {
          if (selectedKeywords.includes(kw.key+":"+kw.value)) {
            keywordIds.push(kw.id);
          }
        });
      });
      
      if (keywordIds.length > 0) {
        await deleteKeywordsBatch(keywordIds);
        setSelectedKeywords([]);
        setImageFilterData((prev) => ({ ...prev, search_value: '', offset: 0 }));
        await refreshKeywords();
        await refreshImages();
      }
    } catch (e) {
      setError(e?.message || '키워드 삭제 실패');
    }
  }, [selectedKeywords, keywordsByKey, refreshKeywords, refreshImages]);

  // 선택된 이미지들의 DNA 교집합을 찾는 함수
  const findDnaIntersection = useCallback((imageIds) => {
    if (!imageIds || imageIds.size === 0) {
      setSelectedKeywords([]);
      return;
    }

    // 선택된 이미지들의 DNA 데이터 수집
    const selectedImagesDna = [];
    Object.values(imagesByGroup || {}).forEach(groupImages => {
      groupImages.forEach(image => {
        if (imageIds.has(image.id) && image.dna) {
          try {
            const dnaData = JSON.parse(image.dna);
            selectedImagesDna.push(dnaData);
          } catch (e) {
            console.warn('DNA 파싱 실패:', image.id, e);
          }
        }
      });
    });

    if (selectedImagesDna.length === 0) {
      setSelectedKeywords([]);
      return;
    }

    // 첫 번째 이미지의 DNA를 기준으로 교집합 찾기
    const firstImageDna = selectedImagesDna[0];
    const commonKeywords = [];

    firstImageDna.forEach(firstKeyword => {
      // 모든 선택된 이미지에 이 키워드가 있는지 확인
      const isCommon = selectedImagesDna.every(imageDna => 
        imageDna.some(keyword => 
          keyword.key === firstKeyword.key && 
          keyword.value === firstKeyword.value
        )
      );

      if (isCommon) {
        commonKeywords.push(firstKeyword.key+":"+firstKeyword.value);
      }
    });

    setSelectedKeywords(commonKeywords);
  }, [imagesByGroup]);

  useEffect(() => {
    // 선택된 이미지가 있을 때만 DNA 교집합 갱신 (없으면 사용자 선택 유지)
    if (selectedImageIds && selectedImageIds.size > 0) {
      findDnaIntersection(selectedImageIds);
    }
  }, [selectedImageIds, imagesByGroup, findDnaIntersection]);

  const value = useMemo(() => ({
    imageFilterData,
    setImageFilterData,
    imagesByGroup,
    groupPreview,
    keywordsByKey,
    selectedImageIds,
    selectedKeywords,
    loading,
    error,
    // actions
    refreshImages,
    refreshGroupPreview,
    refreshKeywords,
    toggleGroupName,
    setSearchFromKeywords,
    toggleSelectImage,
    clearSelection,
    bulkDelete,
    bulkSetGroup,
    bulkDeleteKeywords,
    findDnaIntersection,
  }), [
    imageFilterData,
    imagesByGroup,
    groupPreview,
    keywordsByKey,
    selectedImageIds,
    selectedKeywords,
    loading,
    error,
    refreshImages,
    refreshGroupPreview,
    refreshKeywords,
    toggleGroupName,
    setSearchFromKeywords,
    toggleSelectImage,
    clearSelection,
    bulkDelete,
    bulkSetGroup,
    bulkDeleteKeywords,
    findDnaIntersection,
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


