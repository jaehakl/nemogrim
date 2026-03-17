import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Generate } from './pages/Generate/Generate';
import { Story } from './pages/Story/Story';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <header className="app-navbar">
        <nav className="app-nav">
          <NavLink
            to="/generate"
            className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
          >
            Generate
          </NavLink>
          <NavLink
            to="/story"
            className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
          >
            Story
          </NavLink>
        </nav>
      </header>

      <div className="app-page">
        <Routes>
          <Route path="/" element={<Navigate to="/generate" replace />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/story" element={<Story />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
