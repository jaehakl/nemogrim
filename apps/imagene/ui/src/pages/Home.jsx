import React from 'react';
import { Container, Content, Sidebar } from 'rsuite';
import { SidebarPanel } from '../components/SidebarPanel/SidebarPanel';
import { ContentArea } from '../components/ContentArea/ContentArea';
import './Home.css';

export default function Home() {
  return (
    <Container className="Home">
      <Sidebar width={320} className="home-sidebar">
        <SidebarPanel />
      </Sidebar>
      <Content className="home-content">
        <ContentArea />
      </Content>
    </Container>
  );
}


