import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './theme/theme'
import { useLangStore } from './i18n/useT'
import { startAutosave } from './store/autosave'

applyTheme(loadTheme())
// 前回の構成を復元してから、自動保存を始める
startAutosave()
document.documentElement.lang = useLangStore.getState().lang

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
