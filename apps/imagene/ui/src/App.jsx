import React from 'react';
import { Container, Content, Sidebar, Divider } from 'rsuite';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ContentArea } from './pages/ContentArea/ContentArea';
import { ImageGenPage } from './pages/ImageGenPage/ImageGenPage';
import { ImageStatistics } from './components/ImageStatistics/ImageStatistics';
import { Navbar } from './components/Navbar/Navbar';
import { CustomTagPicker } from './components/CustomTagPicker/CustomTagPicker';
import { Groups } from './components/Groups/Groups';
import { ImageFilterProvider } from './contexts/ImageFilterContext';

import './App.css';


function App() {  
  return (
    <ImageFilterProvider>
      <div className="app-container">
        <Navbar />
        <Container className="app-home">
          <Sidebar width={320} className="app-home-sidebar">
          <Groups />
            <Divider>Keywords</Divider>
            <CustomTagPicker
              placeholder="키워드 선택"
              searchable
            />
          </Sidebar>
          <Content className="app-home-content">
            <Routes>
              <Route path="/" element={<ContentArea />} />
              <Route path="/image-gen" element={<ImageGenPage />} />
              <Route path="/statistics" element={<ImageStatistics />} />
            </Routes>
          </Content>
        </Container>
      </div>
    </ImageFilterProvider>
  );
}

export default App;