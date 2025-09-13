import React from 'react';
import { Divider } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { API_URL, deleteGroupBatch, editGroupName } from '../../api/api';
import './Groups.css';

export const Groups = () => {
  const {
    imageFilterData,
    groupPreview,
    toggleGroupId,
    bulkSetGroup,
  } = useImageFilter();

  const handleDeleteGroup = async (groupId, groupName) => {
    if (window.confirm(`그룹 "${groupName}"을(를) 삭제하시겠습니까?`)) {
      try {
        await deleteGroupBatch([groupId]);
        // 페이지 새로고침 또는 상태 업데이트
        window.location.reload();
      } catch (error) {
        console.error('그룹 삭제 실패:', error);
        alert('그룹 삭제에 실패했습니다.');
      }
    }
  };

  const openSetGroupDialog = async () => {
    const name = prompt('설정할 그룹명을 입력하세요');
    if (name) await bulkSetGroup({groupName : name});
  };

  const handleEditGroupName = async (groupId, groupName) => {
    const name = prompt('변경할 그룹명을 입력하세요');
    if (name) await editGroupName({id : groupId, name : name});
  };


  return (
    <>
      <Divider>Groups</Divider>
      <div className="Groups-container">
        {groupPreview.map((group) => {
          const isSelected = imageFilterData.group_ids && imageFilterData.group_ids.includes(group.id);
          return (
            <button 
              key={group.id} 
              className={`Groups-button ${isSelected ? 'Groups-button--selected' : 'Groups-button--not-selected'}`} 
              onClick={() => toggleGroupId(group.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {bulkSetGroup({groupId : group.id}); e.preventDefault()}}
              draggable
            >
              <div className="Groups-action-buttons">
                <div 
                  className="Groups-edit-name-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditGroupName(group.id, group.name);
                  }}
                  title="그룹 이름 변경"
                >
                  ✏️
                </div>
                <div 
                  className="Groups-delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteGroup(group.id, group.name);
                  }}
                  title="그룹 삭제"
                >
                  ×
                </div>
              </div>
              <div className="Groups-name">{group.name} ({group.n_images})</div>              
              <div className="Groups-thumbnails">
                {(group.thumbnail_images_urls || []).slice(0, 5).map((img_url, index) => (
                  <img key={`${group.name}-${img_url}-${index}`} src={API_URL+"/"+img_url} alt={group.name} />
                ))}
              </div>
            </button>
          );
        })}
      <button className="Groups-button" appearance="ghost" onClick={openSetGroupDialog}>
        <div className="Groups-name">+ 새 그룹 생성</div>
      </button>
      </div>
    </>
  );
};
