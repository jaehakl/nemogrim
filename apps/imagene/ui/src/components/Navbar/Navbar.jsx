import React from 'react';
import { Nav, Navbar as RSNavbar } from 'rsuite';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
  const location = useLocation();

  return (
    <RSNavbar className="navbar-custom">
      <RSNavbar.Brand as={Link} to="/" className="navbar-brand">
        Imagene
      </RSNavbar.Brand>
      <Nav>
        <Nav.Item 
          as={Link} 
          to="/" 
          active={location.pathname === '/'}
          className="navbar-item"
        >
          갤러리
        </Nav.Item>
        <Nav.Item 
          as={Link} 
          to="/image-gen" 
          active={location.pathname === '/image-gen'}
          className="navbar-item"
        >
          이미지 생성
        </Nav.Item>
        <Nav.Item 
          as={Link} 
          to="/statistics" 
          active={location.pathname === '/statistics'}
          className="navbar-item"
        >
          통계 분석
        </Nav.Item>
      </Nav>
    </RSNavbar>
  );
}
