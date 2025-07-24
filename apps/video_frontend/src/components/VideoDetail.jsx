import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideo, updateVideo } from '../api/api';
import VideoPlayer from './VideoPlayer';
import './VideoDetail.css';

function VideoDetail() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    actor: '',
    keywords: '',
    filename: ''
  });


  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getVideo(videoId);
        setVideo(response.data);
        // 폼 데이터 초기화
        setFormData({
          title: response.data.title || '',
          actor: response.data.actor || '',
          keywords: response.data.keywords || '',
          filename: response.data.filename || ''
        });
      } catch (error) {
        console.error("Error fetching video:", error);
        setError("영상 정보를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    // 원래 데이터로 폼 초기화
    setFormData({
      title: video.title || '',
      actor: video.actor || '',
      keywords: video.keywords || '',
      filename: video.filename || ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  const handleSaveClick = async () => {
    try {
      setSaving(true);
      
      // Form 데이터로 변환
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('actor', formData.actor);
      formDataToSend.append('keywords', formData.keywords);
      

      
      const response = await updateVideo(videoId, {"title": formData.title, "actor": formData.actor, "keywords": formData.keywords});
      setVideo(response.data);
      setIsEditing(false);

      // 성공 메시지 표시 (선택사항)
      alert('메타정보가 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error("Error updating video:", error);
      alert('메타정보 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="video-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>영상 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-detail">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={handleBackClick} className="back-btn">뒤로 가기</button>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="video-detail">
        <div className="error-container">
          <p className="error-message">영상을 찾을 수 없습니다.</p>
          <button onClick={handleBackClick} className="back-btn">뒤로 가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-detail">
      <div className="video-detail-header">
        <button onClick={handleBackClick} className="back-btn">
          ← 뒤로 가기
        </button>
        <h1>{video.title || video.filename}</h1>
        {!isEditing && (
          <button onClick={handleEditClick} className="edit-btn">
            편집
          </button>
        )}
      </div>
      
      <div className="video-detail-content">
        <div className="video-player-container">
          <VideoPlayer
            video={video}
            videoStartTime={0}
            maxHistoryDisplay={-1}
          />
        </div>
        
        <div className="video-info">
          <div className="info-section">
            <h3>영상 정보</h3>
            
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label htmlFor="title">제목:</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="영상 제목을 입력하세요"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="actor">배우:</label>
                  <input
                    type="text"
                    id="actor"
                    name="actor"
                    value={formData.actor}
                    onChange={handleInputChange}
                    placeholder="배우명을 입력하세요"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="keywords">키워드:</label>
                  <input
                    type="text"
                    id="keywords"
                    name="keywords"
                    value={formData.keywords}
                    onChange={handleInputChange}
                    placeholder="키워드를 입력하세요 (쉼표로 구분)"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="filename">파일명: <span className="readonly-label"></span></label>
                  <input
                    type="text"
                    id="filename"
                    name="filename"
                    value={formData.filename}
                    onChange={handleInputChange}
                    placeholder="파일명을 입력하세요"
                    readOnly
                    className="readonly-input"
                  />
                </div>
                

                
                <div className="form-actions">
                  <button 
                    onClick={handleSaveClick} 
                    className="save-btn"
                    disabled={saving}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button 
                    onClick={handleCancelClick} 
                    className="cancel-btn"
                    disabled={saving}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-display">
                {video.title && (
                  <div className="info-item">
                    <span className="info-label">제목:</span>
                    <span className="info-value">{video.title}</span>
                  </div>
                )}
                {video.actor && (
                  <div className="info-item">
                    <span className="info-label">배우:</span>
                    <span className="info-value">{video.actor}</span>
                  </div>
                )}
                {video.keywords && (
                  <div className="info-item">
                    <span className="info-label">키워드:</span>
                    <span className="info-value">{video.keywords}</span>
                  </div>
                )}

                <div className="info-item">
                  <span className="info-label">ID:</span>
                  <span className="info-value">{video.id}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoDetail; 