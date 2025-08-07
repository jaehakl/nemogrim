import React, { useState, useEffect } from 'react';
import { Container, Content, Sidebar, Button, Form, Input } from 'rsuite';
import { useLocation, matchPath, useNavigate } from 'react-router-dom';
import { getFiguresFromPrompt } from './api/api';
import { useFigure } from './hooks/useItem';
import 'rsuite/dist/rsuite.min.css';
import "./App.less";

import FigureForm from './components/figure_form';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const figureMatch = matchPath("/figure/:id", location.pathname);

  const { data: figure, loading, error, save } = useFigure(figureMatch?.params.id);
  const [figureList, setFigureList] = useState([]);
  const [showGalleryMode, setShowGalleryMode] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const handlePromptChange = (prompt) => {
    getFiguresFromPrompt(prompt).then(res => {
      setFigureList(res.data);
    });
  }

  useEffect(() => {
    if (figure) {
      setFigureList(figure.related_figures);
    }
  }, [figure]);

  // 감상모드 이미지 변경 타이머
  useEffect(() => {
    if (!showGalleryMode || figureList.length === 0) return;
    const interval = setInterval(() => {
      setGalleryIndex(Math.floor(Math.random() * figureList.length));
    }, 5000);
    return () => clearInterval(interval);
  }, [showGalleryMode, figureList]);

  // 감상모드 진입 시 인덱스 초기화
  useEffect(() => {
    if (showGalleryMode && figureList.length > 0) {
      setGalleryIndex(Math.floor(Math.random() * figureList.length));
    }
  }, [showGalleryMode, figureList]);

  return (
    <Container style={{ whiteSpace: "pre-wrap", minWidth: "800px", minHeight: "500px" }}>
      {/* 감상모드 버튼 */}
      <Button appearance="primary" onClick={() => setShowGalleryMode(true)} style={{ position: "absolute", right: 30, top: 30, zIndex: 10 }}>
        감상모드
      </Button>
      {/* 감상모드 전체화면 위젯 */}
      {showGalleryMode && figureList.length > 0 && (
        <div style={{
          position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
        }}>
          <img
            src={"http://localhost:8000/" + figureList[galleryIndex].file_path}
            alt="감상모드"
            style={{
              width: "100vw",
              height: "100vh",
              objectFit: "contain",
              borderRadius: 0,
              boxShadow: "0 0 32px #000",
              background: "#111"
            }}
          />
          <Button appearance="ghost" color="red" onClick={() => setShowGalleryMode(false)} style={{ position: "fixed", top: 32, right: 32, zIndex: 10000 }}>
            감상모드 종료
          </Button>
        </div>
      )}
      <Sidebar style={{ minWidth: "500px" }}>
        <FigureForm onPromptChange={handlePromptChange} defaultPrompt={figure} onSave={save} />
      </Sidebar>
      <Content style={{ minWidth: "500px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
          gap: "16px", 
          flex: 1, 
          minWidth: 600 
        }}>
          {figure && (
            <div style={{ marginBottom: 12, gridColumn: "1 / -1" }}>
              <img src={"http://localhost:8000/" + figure.file_path} alt="미리보기" style={{ maxWidth: 480, maxHeight: 480, display: "block" }} />
            </div>
          )}
          {figureList.map(figure => (
            <div 
              key={figure.id} 
              onClick={() => navigate(`/figure/${figure.id}`)}
              style={{ cursor: "pointer", background: "#fafafa", borderRadius: 8, padding: 8, textAlign: "center" }}
            >              
              <img 
                src={"http://localhost:8000/" + figure.file_path} 
                alt="미리보기" 
                style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 4 }} 
              />
            </div>
          ))}
        </div>
      </Content>
    </Container>
  );
}

export default App;





