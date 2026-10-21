// 기본 스타일을 컴포넌트 스타일보다 먼저 불러와야 컴포넌트 규칙이 우선한다.
import './styles/global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { createQueryClient } from './app/queryClient'
import { ToastProvider } from './components/ui/Toast'

const root = document.getElementById('root')
if (!root) throw new Error('root 요소를 찾을 수 없습니다')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
