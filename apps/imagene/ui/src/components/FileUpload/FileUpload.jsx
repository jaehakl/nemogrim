import React, { useState, useRef } from 'react';
import { Button, Card, Panel, IconButton } from 'rsuite';
import { Icon } from '@rsuite/icons';
import { Close, Plus } from '@rsuite/icons';

export const FileUpload = ({ uploadedFiles, setUploadedFiles, previewImages, setPreviewImages }) => {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFiles = (files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    setUploadedFiles(prev => [...prev, ...imageFiles]);
    
    // 미리보기 이미지 생성
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImages(prev => [...prev, {
          file,
          url: e.target.result,
          id: Date.now() + Math.random()
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const handleRemoveFile = (fileId) => {
    setPreviewImages(prev => {
      const imageToRemove = prev.find(img => img.id === fileId);
      if (imageToRemove) {
        setUploadedFiles(prevFiles => 
          prevFiles.filter(file => file !== imageToRemove.file)
        );
        return prev.filter(img => img.id !== fileId);
      }
      return prev;
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  return (
    <Card style={{ marginBottom: '15px' }}>
      <Card.Header style={{ padding: '10px 15px' }}>
        <h5 style={{ margin: 0, fontSize: '14px' }}>이미지 파일 업로드</h5>
      </Card.Header>
      <Card.Body style={{ padding: '10px 15px' }}>
        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: isDragOver ? '2px dashed #3498db' : '2px dashed #ddd',
            borderRadius: '4px',
            padding: '15px 10px',
            textAlign: 'center',
            backgroundColor: isDragOver ? '#f8f9fa' : '#fff',
            transition: 'all 0.3s ease',
            marginBottom: '10px',
            cursor: 'pointer',
            minHeight: '60px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onClick={handleUploadClick}
        >
          <Icon as={Plus} style={{ fontSize: '20px', color: isDragOver ? '#3498db' : '#999', marginBottom: '5px' }} />
          <div style={{ fontSize: '12px', color: isDragOver ? '#3498db' : '#666', marginBottom: '2px' }}>
            {isDragOver ? '파일을 여기에 놓으세요' : '드래그하거나 클릭하여 선택'}
          </div>
          <div style={{ fontSize: '10px', color: '#999' }}>
            JPG, PNG, GIF, WebP
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Button 
            onClick={handleUploadClick}
            appearance="ghost"
            color="blue"
            size="sm"
            startIcon={<Icon as={Plus} />}
          >
            파일 선택
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        
        {/* 업로드된 파일 미리보기 */}
        {previewImages.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <h6 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
              업로드된 이미지 ({previewImages.length}개)
            </h6>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
              gap: '6px'
            }}>
              {previewImages.map((image) => (
                <div key={image.id} style={{ position: 'relative' }}>
                  <Panel 
                    style={{ 
                      padding: '3px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}
                  >
                    <img
                      src={image.url}
                      alt={image.file.name}
                      style={{
                        width: '100%',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '2px'
                      }}
                    />
                    <div style={{ 
                      fontSize: '9px', 
                      marginTop: '3px',
                      wordBreak: 'break-all',
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {image.file.name}
                    </div>
                    <div style={{ 
                      fontSize: '8px', 
                      color: '#999',
                      marginTop: '1px'
                    }}>
                      {(image.file.size / 1024 / 1024).toFixed(1)}MB
                    </div>
                    <IconButton
                      icon={<Icon as={Close} />}
                      size="xs"
                      circle
                      color="red"
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'rgba(255,255,255,0.9)',
                        width: '16px',
                        height: '16px',
                        minWidth: '16px'
                      }}
                      onClick={() => handleRemoveFile(image.id)}
                    />
                  </Panel>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
