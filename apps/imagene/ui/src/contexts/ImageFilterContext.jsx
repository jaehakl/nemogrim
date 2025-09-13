import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  filterImages,
  getGroupPreviewBatch,
  deleteImagesBatch,
  setImageGroupBatch,
  unsetImageGroupBatch,
  deleteKeywordsBatch,
} from '../api/api';

const defaultFilter = {
  group_ids: [],
  search_value: '',
  limit: 1000,
  offset: 0,
};

const ImageFilterContext = createContext(null);

export const ImageFilterProvider = ({ children }) => {
  const [imageFilterData, setImageFilterData] = useState(defaultFilter);
  const [images, setImages] = useState([]);
  const [groupPreview, setGroupPreview] = useState([]);
  const [keywordsByKey, setKeywordsByKey] = useState({});
  const [groupKeywords, setGroupKeywords] = useState({});
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [selectedKeywords, setSelectedKeywords] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    refreshImages();
    // 초기 사이드바 데이터
    refreshGroupPreview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 필터 변경 시 목록 새로고침
    refreshImages();
  }, [imageFilterData, refreshImages]);

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
    images,
    groupPreview,
    keywordsByKey,
    groupKeywords,
    selectedImageIds,
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
  }), [
    imageFilterData,
    images,
    groupPreview,
    keywordsByKey,
    groupKeywords,
    selectedImageIds,
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


