import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA features
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('نسخه جدیدی از برنامه موجود است. آیا می‌خواهید بروزرسانی کنید؟')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('برنامه آماده کار آفلاین است')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)