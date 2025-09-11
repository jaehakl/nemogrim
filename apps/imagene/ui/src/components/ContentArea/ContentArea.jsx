import React, { useMemo, useState } from 'react';
import { Panel, Stack, Button, Input, Pagination, InputNumber, SelectPicker } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { API_URL } from '../../api/api';
import './ContentArea.css';

export const ContentArea = () => {
  const {
    imagesByGroup,
    imageFilterData,
    setImageFilterData,
    selectedImageIds,
    toggleSelectImage,
    bulkDelete,
    bulkSetGroup,
  } = useImageFilter();

  const [pageByGroup, setPageByGroup] = useState({});
  const [pageSize, setPageSize] = useState(10); // 클라이언트 페이지네이션 크기
  const [aspectRatio, setAspectRatio] = useState('1 / 1.2');

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

  const groups = useMemo(() => Object.keys(imagesByGroup || {}), [imagesByGroup]);

  const handlePageChange = (groupName, page) => {
    setPageByGroup((prev) => ({ ...prev, [groupName]: page }));
  };

  const openSetGroupDialog = async () => {
    const name = prompt('설정할 그룹명을 입력하세요');
    if (name) await bulkSetGroup(name);
  };

  const onDragStart = (e, imageId) => {
    if (!selectedImageIds.has(imageId)){
      toggleSelectImage(imageId);
    }
    e.dataTransfer.setData('text/plain', String(imageId));
  };

  const onDropToGroup = async (e, groupName) => {
    const idText = e.dataTransfer.getData('text/plain');
    const imageId = parseInt(idText, 10);
    if (!Number.isFinite(imageId)) return;
    toggleSelectImage(imageId); // 선택 토글로 포함시킴
    await bulkSetGroup(groupName);
  };

  return (
    <div className="ContentArea">
      <div className="ContentArea-toolbar">
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
          <Button onClick={openSetGroupDialog} disabled={(selectedImageIds?.size || 0) === 0}>선택 그룹 지정</Button>
          <Button appearance="ghost" color="red" onClick={bulkDelete} disabled={(selectedImageIds?.size || 0) === 0}>선택 삭제</Button>
        </Stack>
      </div>

      <div className="ContentArea-groups">
        {groups.map((groupName) => (
          <GroupPanel
            key={groupName}
            groupName={groupName}
            images={imagesByGroup[groupName] || []}
            page={pageByGroup[groupName] || 1}
            onPageChange={(p) => handlePageChange(groupName, p)}
            pageSize={pageSize}
            aspectRatio={aspectRatio}
            toggleSelectImage={toggleSelectImage}
            selectedImageIds={selectedImageIds}
            onDragStart={onDragStart}
            onDropToGroup={onDropToGroup}
          />
        ))}
      </div>
    </div>
  );
};

const GroupPanel = ({ groupName, images, page, pageSize, aspectRatio, onPageChange, toggleSelectImage, selectedImageIds, onDragStart, onDropToGroup }) => {
  const total = images.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(page, maxPage);
  const startIndex = (effectivePage - 1) * pageSize;
  const current = images.slice(startIndex, startIndex + pageSize);
  const isUngrouped = groupName === '_ungrouped_';

  return (
    <Panel
      bordered
      header={groupName}
      className={`GroupPanel ${isUngrouped ? 'ungrouped' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropToGroup(e, groupName)}
    >
      <div className="GroupPanel-grid">
        {current.map((img) => {
          const checked = selectedImageIds?.has(img.id);
          return (
            <label
              key={img.id}
              className={`GroupPanel-item ${checked ? 'selected' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(e, img.id)}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleSelectImage(img.id)} />
              <img src={API_URL+"/"+img.url} alt={String(img.id)} style={{ aspectRatio }} />
            </label>
          );
        })}
      </div>
      {total > pageSize && (
        <div className="GroupPanel-pagination">
          <Pagination
            prev
            next
            first
            last
            ellipsis
            boundaryLinks
            total={total}
            limit={pageSize}
            activePage={effectivePage}
            onChangePage={onPageChange}
          />
        </div>
      )}
    </Panel>
  );
};


