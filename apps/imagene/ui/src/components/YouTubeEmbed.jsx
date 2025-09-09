import React, { useState, useEffect, useRef } from 'react';
import './YouTubeEmbed.css';

const YouTubeEmbed = ({ url, size = 100 }) => {
  if (!url) return null;
  const [wrongUrl, setWrongUrl] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(null);
  const iframeRef = useRef(null);
  
  useEffect(() => {
    const videoId = getVideoId(url);
    if (videoId) {
      setEmbedUrl(`https://www.youtube.com/embed/${videoId}?&controls=1&rel=0&modestbranding=1`);
            
    } else {
      setWrongUrl(true);
    }
  }, [url]);

  // YouTube URL에서 video ID 추출
  const getVideoId = (youtubeUrl) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = youtubeUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  if (wrongUrl) {
    return (
      <div className="youtube-error" style={{ width: size, height: size }}>
        <span>잘못된 YouTube URL</span>
      </div>
    );
  }

  return (
    <div className="youtube-embed-container" style={{ width: size, height: size }}>
      {embedUrl && <iframe        
        ref={iframeRef}
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
        allowFullScreen
        style={{ width: '100%', height: '100%' }}
      />}
    </div>
  );
};

export default YouTubeEmbed;
