import React, { useMemo, useState, useEffect } from 'react';
import { Panel, Stack, Button, Input, Pagination, InputNumber, SelectPicker } from 'rsuite';
import { useImageFilter } from '../../contexts/ImageFilterContext';
import { API_URL, deletePathBatch } from '../../api/api';
import { PromptInput } from '../../components/PromptInput/PromptInput';
import GenerationConfig from '../../components/GenerationConfig/GenerationConfig';
import { ImageGenerator } from '../../components/ImageGenerator/ImageGenerator';
import { FileUpload } from '../../components/FileUpload/FileUpload';
import { getImageDetail } from '../../api/api';
import './ContentArea.css';

export const ContentArea = () => {
  const {
    setDirectory,
    images,
    hoveredImage,
    selectedImageIds
  } = useImageFilter();

  const [imageDirectories, setImageDirectories] = useState([]);
  const [similarImages, setSimilarImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  useEffect(() => {
    if (hoveredImage) {
      setCurrentImage(hoveredImage);
    } else if (selectedImageIds.size > 0) {
      setCurrentImage(images.find(image => selectedImageIds.has(image.id)));
    } else {
      setCurrentImage(null);
      setImageDirectories([]);
      setSimilarImages([]);
    }
  }, [hoveredImage]);

  useEffect(() => {
    if (selectedImageIds.size > 0) {
      setCurrentImage(images.find(image => selectedImageIds.has(image.id)));
      getImageDetail(selectedImageIds.values().next().value).then(response => {
        setImageDirectories(response.data.directories);
        setSimilarImages(response.data.similar_images);
      });
    } else {
      setCurrentImage(null);
      setImageDirectories([]);
      setSimilarImages([]);
    }
  }, [selectedImageIds, images]);

  function handleSimilarImageClick(imageId) {
    setCurrentImage(similarImages.find(image => image.id === imageId));
    getImageDetail(imageId).then(response => {
      setImageDirectories(response.data.directories);
      setSimilarImages(response.data.similar_images);
    });
  }

  return (
    <div className="content-area">
        {currentImage ? (
          <div className="content-area-preview-image">
            <img 
              src={API_URL+"/"+currentImage.url} 
              alt={String(currentImage.id)} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
            
            <div className="image-directories">
              <h3>디렉토리</h3>
              <div className="directory-list">
                {imageDirectories.map((directory, index) => (
                  <div key={index} className="directory-item" onClick={() => setDirectory({path: directory})}>
                    {directory}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="similar-images">
              <h3>유사한 이미지</h3>
              <div className="similar-images-grid">
                {similarImages.map((image) => (
                  <div key={image.id} className="similar-image-item" onClick={() => handleSimilarImageClick(image.id)}>
                    <img 
                      src={API_URL+"/"+image.url} 
                      alt={String(image.id)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  ))}
                </div>
              </div>
          </div>
        ) : (
          <>
            <GenerationConfig />
            <ImageGenerator 
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              previewImages={previewImages}
              setPreviewImages={setPreviewImages}
            />
            <PromptInput />
            <FileUpload 
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              previewImages={previewImages}
              setPreviewImages={setPreviewImages}
            />
          </>
        )}
      
    </div>
  );
};


