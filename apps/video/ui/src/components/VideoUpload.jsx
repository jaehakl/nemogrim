import React, { useState } from 'react';
import { uploadVideo } from '../api/api';
import './VideoUpload.css';

function VideoUpload() {
  const [selectedFile, setSelectedFile] = useState(null);

  const [actor, setActor] = useState('');
  const [title, setTitle] = useState('');
  const [filename, setFilename] = useState('');
  const [keywords, setKeywords] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setMessage('');
    
    // 파일이 선택되면 파일명을 제목과 파일명 필드에 자동으로 설정
    if (file) {
      // 파일 확장자 제거하고 파일명만 추출
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(fileName);
      setFilename(fileName);
    }
  };



  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('파일을 선택해주세요.');
      return;
    }

    if (!actor.trim()) {
      setMessage('배우 이름을 입력해주세요.');
      return;
    }

    if (!title.trim()) {
      setMessage('제목을 입력해주세요.');
      return;
    }

    setUploading(true);
    setMessage('업로드 중...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('actor', actor.trim());
    formData.append('title', title.trim());
    formData.append('filename', filename.trim());
    formData.append('keywords', keywords.trim());
    
    try {
      const response = await uploadVideo(formData);
      setMessage(response.data.message);
      
      // 폼 초기화
      setSelectedFile(null);
      setActor('');
      setTitle('');
      setFilename('');
      setKeywords('');
      
      // 파일 입력 필드 초기화
      document.getElementById('video-file').value = '';
      
      // 업로드 성공 이벤트 발생
      window.dispatchEvent(new Event('videoUploadSuccess'));
      
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(error.response?.data?.detail || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload">
      <h2>영상 업로드</h2>
      <div className="upload-form">
        <div className="form-group">
          <label htmlFor="video-file">영상 파일:</label>
          <input
            type="file"
            id="video-file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        


        <div className="form-group">
          <label htmlFor="actor">배우:</label>
          <input
            type="text"
            id="actor"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="배우 이름을 입력하세요"
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="title">제목:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="영상 제목을 입력하세요"
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="filename">파일명:</label>
          <input
            type="text"
            id="filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="저장할 파일명을 입력하세요"
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="keywords">키워드:</label>
          <textarea
            id="keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="키워드를 입력하세요 (쉼표로 구분)"
            disabled={uploading}
          />
        </div>

        <button 
          onClick={handleUpload} 
          disabled={uploading || !selectedFile}
          className="upload-btn"
        >
          {uploading ? '업로드 중...' : '업로드'}
        </button>

        {message && (
          <div className={`message ${message.includes('실패') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoUpload;