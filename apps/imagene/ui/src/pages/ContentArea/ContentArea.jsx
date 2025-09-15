import React, { useMemo, useState, useEffect } from 'react';
import { Panel, Stack, Button, Input, Pagination, InputNumber, SelectPicker } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { API_URL } from '../../api/api';
import './ContentArea.css';

export const ContentArea = () => {
  const {
    images,
    imageFilterData,
    setImageFilterData,
    selectedImageIds,
    toggleSelectImage,
    bulkDelete,
    bulkSetGroup,
    bulkUnsetGroup,
  } = useImageFilter();
  const [pageSize, setPageSize] = useState(32); // 클라이언트 페이지네이션 크기
  const [currentPage, setCurrentPage] = useState(1); // 현재 페이지
  const [aspectRatio, setAspectRatio] = useState('1 / 1.2');
  const [hoveredImage, setHoveredImage] = useState(null);

  const aspectRatioOptions = useMemo(() => ([
    { label: '1:1', value: '1 / 1' },
    { label: '2:3', value: '2 / 3' },
    { label: '3:4', value: '3 / 4' },
    { label: '4:5', value: '4 / 5' },
    { label: '1:1.2', value: '1 / 1.2' },
    { label: '9:16', value: '9 / 16' },
    { label: '3:2', value: '3 / 2' },
    { label: '16:9', value: '16 / 9' },
  ]), []);

  // 페이지네이션된 이미지 데이터 계산
  const paginatedImages = useMemo(() => {
    if (!images || images.length === 0) return [];
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return images.slice(startIndex, endIndex);
  }, [images, currentPage, pageSize]);

  // 전체 페이지 수 계산
  const totalPages = useMemo(() => {
    if (!images || images.length === 0) return 1;
    return Math.ceil(images.length / pageSize);
  }, [images, pageSize]);

  // 페이지 크기 변경 시 현재 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  return (
    <div className="content-area">
      <div className="content-area-toolbar">
        <Stack spacing={8} alignItems="center">
          <Input placeholder="검색어(,로 구분)" value={imageFilterData?.search_value || ''} onChange={(val) => setImageFilterData((prev) => ({ ...prev, search_value: val }))} style={{ width: 300 }} />
          <Button appearance="primary" onClick={() => { /* Auto refresh by effect */ }}>검색</Button>
          <SelectPicker data={aspectRatioOptions} value={aspectRatio} onChange={(val) => val && setAspectRatio(val)} placeholder="비율" cleanable={false} searchable={false} style={{ width: 110 }} />
          <span>페이지당</span>
          <InputNumber min={1} max={100} value={pageSize} onChange={(val) => {
            const n = Number(val);
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(1, Math.min(100, Math.floor(n)));
            setPageSize(clamped);
          }} style={{ width: 90 }} />
          <span>개</span>
          <Button appearance="ghost" color="red" onClick={bulkDelete} disabled={(selectedImageIds?.size || 0) === 0}>선택 삭제</Button>
          <Button appearance="ghost" color="blue" onClick={bulkUnsetGroup} disabled={(selectedImageIds?.size || 0) === 0}>선택 그룹 해제</Button>
        </Stack>
      </div>
      <div className="content-area-main">
        <div className="content-area-left">
          {paginatedImages && paginatedImages.map((img) => {
            const checked = selectedImageIds?.has(img.id);
            return (
              <label
                key={img.id}
                className={`content-area-group-panel-item ${checked ? 'selected' : ''}`}
                draggable
                onDragStart={(e) => {if (!selectedImageIds.has(img.id)){toggleSelectImage(img.id);}}}
                onMouseEnter={() => setHoveredImage(img)}
                onMouseLeave={() => setHoveredImage(null)}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleSelectImage(img.id)} />
                <img src={API_URL+"/"+img.url} alt={String(img.id)} style={{ aspectRatio }} />
              </label>
            );
          })}      
        </div>
        <div className="content-area-right">
          <div className="content-area-preview-header">
            <h4>원본 이미지</h4>
          </div>
          {hoveredImage && (
            <div className="content-area-preview-metadata">
              <div className="metadata-compact">
                <div className="metadata-row">
                  <span className="metadata-item">Steps: {hoveredImage.steps}</span>
                  <span className="metadata-item">CFG: {hoveredImage.cfg}</span>
                  <span className="metadata-item">{hoveredImage.width}×{hoveredImage.height}</span>
                </div>
                {hoveredImage.keywords && hoveredImage.keywords.length > 0 && (
                  <div className="metadata-keywords-compact">
                    {hoveredImage.keywords.map((keyword, index) => (<>
                      {(keyword.key !== 'negative') && (
                      <span 
                        key={index} 
                        className={`metadata-keyword ${keyword.direction > 0 ? 'positive' : 'negative'}`}
                      >
                        {keyword.key}: {keyword.value}
                        {keyword.weight !== 1.0 && ` (${keyword.weight})`}
                      </span>
                      )}
                      </>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="content-area-preview-image">
            {hoveredImage ? (
              <img 
                src={API_URL+"/"+hoveredImage.url} 
                alt={String(hoveredImage.id)} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div className="content-area-preview-placeholder">
                이미지에 마우스를 올려보세요
              </div>
            )}
          </div>

        </div>
      </div>
      {totalPages > 1 && (
        <div className="content-area-pagination">
          <Pagination
            prev
            next
            first
            last
            ellipsis
            boundaryLinks
            maxButtons={5}
            size="sm"
            pages={totalPages}
            activePage={currentPage}
            onSelect={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );
};


