import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './theme/theme'
import { useLangStore } from './i18n/useT'

applyTheme(loadTheme())
document.documentElement.lang = useLangStore.getState().lang

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
