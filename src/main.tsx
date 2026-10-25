import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Web fonts were requested as print media so they never block first paint; switch them on now.
const fonts = document.getElementById('webfonts') as HTMLLinkElement | null
if (fonts) fonts.media = 'all'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
