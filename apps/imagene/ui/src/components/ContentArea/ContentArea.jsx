import React, { useMemo, useState } from 'react';
import { Panel, Stack, Button, Input } from 'rsuite';
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

  

  const groups = useMemo(() => Object.keys(imagesByGroup || {}), [imagesByGroup]);

  

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

const GroupPanel = ({ groupName, images, toggleSelectImage, selectedImageIds, onDragStart, onDropToGroup }) => {
  const total = images.length;
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
        {images.map((img) => {
          const checked = selectedImageIds?.has(img.id);
          return (
            <label
              key={img.id}
              className={`GroupPanel-item ${checked ? 'selected' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(e, img.id)}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleSelectImage(img.id)} />
              <img src={API_URL+"/"+img.url} alt={String(img.id)} />
            </label>
          );
        })}
      </div>
    </Panel>
  );
};


