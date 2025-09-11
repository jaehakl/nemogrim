import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ImageFilterProvider } from './contexts/ImageFilterContext.jsx'
import 'rsuite/dist/rsuite-no-reset.min.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ImageFilterProvider>
        <App />
      </ImageFilterProvider>
    </BrowserRouter>
  </StrictMode>,
)
