import React, { useState } from 'react';
import './EditableTable.css';

const EditableTable = ({ 
  columns, 
  data, 
  onDataChange,
  addRowText = "행 추가",
  deleteRowText = "삭제",
  onUpdate,
  onDelete,
  onAction,
  onCellClick,
  actionText = "처리",
  showAddRow = true,
  showPasteButton = true,
  showCopyButton = false,
  showDeleteButton = true,
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editedRows, setEditedRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // 정렬된 데이터 계산
  const getSortedData = () => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      // 숫자 정렬
      if (!isNaN(aValue) && !isNaN(bValue)) {
        return sortConfig.direction === 'asc' 
          ? parseFloat(aValue) - parseFloat(bValue)
          : parseFloat(bValue) - parseFloat(aValue);
      }
      
      // 문자열 정렬
      const comparison = aValue.toString().localeCompare(bValue.toString(), 'ko');
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // 정렬 처리
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 정렬 방향 표시 아이콘
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleCellEdit = (rowIndex, columnKey, value) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
    onDataChange(newData);
    setEditedRows([...editedRows, rowIndex].filter((value, index, self) => self.indexOf(value) === index));
  };

  const handleAddRow = () => {
    const newRow = columns.reduce((acc, col) => {
      acc[col.key] = '';
      return acc;
    }, {});
    onDataChange([...data, newRow]);
  };

  const handleDeleteRow = (rowIndex) => {
    if (onDelete) {
      const id = data[rowIndex]?.id;
      if (id) {
        onDelete([id]);
      }
    } else {
      const newData = data.filter((_, index) => index !== rowIndex);
      onDataChange(newData);
    }
  };

  // 선택된 행들 삭제 처리
  const handleDelete = () => {
    if (onDelete && selectedRows.length > 0) {
      if (selectedRows.length === 0) {
        alert('삭제할 수 있는 ID가 없습니다.');
        return;
      }
      const selectedIds = data.filter((_, index) => selectedRows.includes(index))
        .map(row => row.id);
      onDelete(selectedIds);
    }
  };

  const handleAction = () => {
    if (onAction && selectedRows.length > 0) {
      if (selectedRows.length === 0) {
        alert(actionText + '할 수 있는 ID가 없습니다.');
        return;
      }
      const selectedIds = data.filter((_, index) => selectedRows.includes(index))
        .map(row => row.id);
      onAction(selectedIds);
    }
  };

  const handleCellClick = (rowIndex, columnKey) => {
    if (onCellClick) {
      onCellClick(data[rowIndex], columnKey);
    } else {
      setEditingCell({ rowIndex, columnKey });
    }
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyPress = (e, rowIndex, columnKey, value) => {
    if (e.key === 'Enter') {
      handleCellEdit(rowIndex, columnKey, value);
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // 행 선택 처리
  const handleRowSelect = (rowIndex) => {
    setSelectedRows(prev => {
      if (prev.includes(rowIndex)) {
        return prev.filter(index => index !== rowIndex);
      } else {
        return [...prev, rowIndex];
      }
    });
  };

  const handleUpdate = () => {
    const dataToUpdate = data.filter((_, index) => editedRows.includes(index));
    console.log("dataToUpdate", dataToUpdate)
    onUpdate(dataToUpdate);
    setEditedRows([]);
    alert('변경사항이 저장되었습니다.');
  };



  // TSV 붙여넣기 처리
  const handlePasteTSV = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        alert('클립보드에 텍스트가 없습니다.');
        return;
      }

      // TSV 데이터 파싱
      const rows = clipboardText.trim().split('\n');
      const newRows = [];

      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].split('\t');
        if (cells.length >= columns.length) {
          const newRow = {};
          columns.forEach((col, colIndex) => {
            newRow[col.key] = cells[colIndex] ? cells[colIndex].trim() : '';
          });
          newRows.push(newRow);
        }
      }

      if (newRows.length === 0) {
        alert('올바른 TSV 형식이 아닙니다. 각 열은 탭으로 구분되어야 합니다.');
        return;
      }

      // 기존 데이터에 새 행들 추가
      const updatedData = [...data, ...newRows];
      onDataChange(updatedData);
      
      alert(`${newRows.length}개의 행이 추가되었습니다.`);
    } catch (error) {
      console.error('클립보드 읽기 오류:', error);
      alert('클립보드 읽기에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  // 붙여넣기 버튼 클릭 핸들러 (권한 요청 포함)
  const handlePasteClick = async () => {
    try {
      // 클립보드 권한 요청
      const permission = await navigator.permissions.query({ name: 'clipboard-read' });
      
      if (permission.state === 'denied') {
        alert('클립보드 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        return;
      }
      
      await handlePasteTSV();
    } catch (error) {
      console.error('권한 확인 오류:', error);
      // 권한 API를 지원하지 않는 브라우저에서는 직접 시도
      await handlePasteTSV();
    }
  };

  // TSV 복사 처리
  const handleCopyTSV = async () => {
    if (data.length === 0) {
      alert('복사할 데이터가 없습니다.');
      return;
    }

    try {
      // TSV 형식으로 데이터 생성
      const tsvContent = [
        // 헤더
        columns.map(col => col.label).join('\t'),
        // 데이터
        ...data.map(row => 
          columns.map(col => row[col.key] || '').join('\t')
        )
      ].join('\n');

      // 클립보드에 복사
      await navigator.clipboard.writeText(tsvContent);
      alert(`${data.length}개의 행이 TSV 형식으로 클립보드에 복사되었습니다.`);
    } catch (error) {
      console.error('클립보드 복사 오류:', error);
      alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  return (
    <div className="editable-table-container">
      <div className="table-controls">
        {showAddRow && (
          <button onClick={handleAddRow} className="add-row-btn">
            {addRowText}
          </button>
        )}
        {showPasteButton && (
          <button onClick={handlePasteClick} className="paste-btn">
            클립보드에서 붙여넣기 (탭으로 분리)
          </button>
        )}
        {showCopyButton && (
          <button onClick={handleCopyTSV} className="copy-btn">
            클립보드에 복사 (탭으로 분리)
          </button>
        )}
        {onUpdate && (
          <button 
            onClick={handleUpdate} 
            className="update-selected-btn"
            disabled={editedRows.length === 0}
          >
            변경사항 저장
          </button>
        )}
        {onDelete && selectedRows.length > 0 && (
          <button 
            onClick={handleDelete} 
            className="delete-selected-btn"
            disabled={selectedRows.length === 0}
          >
            선택된 {selectedRows.length}개 삭제
          </button>
        )}
        {onAction && selectedRows.length > 0 && (
          <button 
            onClick={handleAction} 
            className="action-selected-btn"
            disabled={selectedRows.length === 0}
          >
            {actionText} {selectedRows.length}개
          </button>
        )}
      </div>
      
      <table className="editable-table">
        <thead>
          <tr>
            {onDelete && (
              <th className="select-column">
                <input
                  type="checkbox"
                  checked={selectedRows.length === data.length && data.length > 0}
                  onChange={() => {
                    if (onDelete) {
                      const allIndices = data.map((_, index) => index);
                      if (selectedRows.length === data.length) {
                        // 전체 해제
                        allIndices.forEach(index => handleRowSelect(index));
                      } else {
                        // 전체 선택
                        allIndices.forEach(index => handleRowSelect(index));
                      }
                    }
                  }}                  
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} onClick={() => handleSort(col.key)}>
                {col.label} {getSortIcon(col.key)}
              </th>
            ))}
            {showDeleteButton && <th>작업</th>}
          </tr>
        </thead>
        <tbody>
          {getSortedData().map((row, rowIndex) => (
            <tr key={rowIndex} className={selectedRows.includes(rowIndex) ? 'selected-row' : ''}>
              {onDelete && (
                <td className="select-column">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(rowIndex)}
                    onChange={() => handleRowSelect(rowIndex)}
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={col.key === 'id' ? 'id-column' : ''}>
                  {onUpdate && editingCell?.rowIndex === rowIndex && editingCell?.columnKey === col.key ? (
                    <input
                      type="text"
                      value={row[col.key] || ''}
                      onChange={(e) => handleCellEdit(rowIndex, col.key, e.target.value)}
                      onBlur={handleCellBlur}
                      onKeyDown={(e) => handleKeyPress(e, rowIndex, col.key, e.target.value)}
                      autoFocus
                      className="cell-input"
                    />
                  ) : (
                    <div
                      className={`cell-content ${col.key === 'id' ? 'id-cell' : ''}`}
                      onClick={() => handleCellClick(rowIndex, col.key)}
                    >
                      {row[col.key]}
                    </div>
                  )}
                </td>
              ))}
              {showDeleteButton && (
              <td>
                <button
                  onClick={() => handleDeleteRow(rowIndex)}
                  className="delete-btn"
                  title={deleteRowText}
                >
                  {deleteRowText}
                </button>
              </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EditableTable;
