import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import App from './App.jsx'
import { registerServiceWorker } from './lib/register-sw.js'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
registerServiceWorker()
